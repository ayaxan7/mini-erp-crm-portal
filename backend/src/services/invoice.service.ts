import fs from 'node:fs';
import path from 'node:path';
import ejs from 'ejs';
import puppeteer from 'puppeteer-core';
import { ApiError } from '../utils/ApiError.js';
import type { ChallanRepository } from '../repositories/challan.repo.js';
import type { CustomerRepository } from '../repositories/customer.repo.js';

const GST_RATE = 18;

const COMPANY = {
  name: 'CRM Operations Portal',
  address: '1st Floor, Tech Park, Bengaluru, Karnataka 560001',
  phone: '+91 90000 00000',
  email: 'billing@crmportal.dev',
  gst: '29ABCDE1234F1Z5',
};

const round2 = (value: number): string => value.toFixed(2);

function viewsDir(): string {
  const prod = path.resolve(process.cwd(), 'views');
  if (fs.existsSync(prod)) return prod;
  return path.resolve(process.cwd(), 'src', 'views');
}

export class InvoiceService {
  constructor(
    private readonly challanRepo: ChallanRepository,
    private readonly customerRepo: CustomerRepository,
  ) {}

  async buildInvoiceData(id: number) {
    const { challan, items } = await this.challanRepo.findById(id);
    if (!challan) {
      throw ApiError.notFound('Challan not found');
    }
    const customer = await this.customerRepo.findById(challan.customer_id);
    if (!customer) {
      throw ApiError.notFound('Customer not found');
    }

    const lines = items.map((item) => ({
      productName: item.product_name,
      productSku: item.product_sku,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      amount: round2(Number(item.unit_price) * item.quantity),
    }));

    const subtotal = items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
    const tax = (subtotal * GST_RATE) / 100;

    return {
      company: COMPANY,
      invoice: {
        number: challan.challan_number,
        date: new Date(challan.confirmed_at ?? challan.created_at).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        status: challan.status,
        remarks: challan.remarks ?? null,
      },
      customer: {
        name: customer.name,
        businessName: customer.business_name ?? null,
        address: customer.address ?? null,
        mobile: customer.mobile,
        email: customer.email ?? null,
        gstNumber: customer.gst_number ?? null,
      },
      items: lines,
      totals: {
        totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: round2(subtotal),
        tax: round2(tax),
        gstRate: GST_RATE,
        total: round2(subtotal + tax),
      },
    };
  }

  async renderHtml(id: number): Promise<string> {
    const data = await this.buildInvoiceData(id);
    return ejs.renderFile(path.join(viewsDir(), 'invoice.ejs'), data);
  }

  async generatePdf(id: number): Promise<Buffer> {
    const html = await this.renderHtml(id);
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (!executablePath) {
      throw new ApiError(503, 'PDF rendering is not configured on this server');
    }
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      return Buffer.from(await page.pdf({ format: 'A4', printBackground: true }));
    } finally {
      await browser.close();
    }
  }
}
