import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { ApiError } from '../../types/api';
import type { Challan, Customer, Product, ChallanLine, ChallanStatus } from '../../types/domain';
import { PageHeader, Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { formatMoney } from '../../utils/format';
import { ArrowLeftIcon, SearchIcon, XIcon, PlusIcon } from '../../components/ui/Icons';
import { CustomerFormModal } from '../customers/CustomerFormModal';
import { ProductFormModal } from '../products/ProductFormModal';
import styles from './ChallanCreate.module.css';

export function ChallanCreatePage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const toast = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerError, setCustomerError] = useState<string | null>(null);

  const [lines, setLines] = useState<ChallanLine[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);

  const [remarks, setRemarks] = useState('');
  const [status, setStatus] = useState<ChallanStatus>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalValue = lines.reduce((sum, line) => sum + Number(line.unitPrice) * line.quantity, 0);

  const loadCustomers = useCallback(async (query: string) => {
    try {
      const res = await api.get<{ data: Customer[] }>('/customers', { search: query || undefined, limit: 20 });
      setCustomers(res.data!.data);
    } catch {
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    void loadCustomers('');
  }, [loadCustomers]);

  useEffect(() => {
    const delay = window.setTimeout(() => void loadCustomers(customerQuery), 300);
    return () => window.clearTimeout(delay);
  }, [customerQuery, loadCustomers]);

  const searchProducts = useCallback(async (query: string) => {
    setSearching(true);
    try {
      const res = await api.get<{ data: Product[] }>('/products', { search: query || undefined, limit: 8 });
      setProductResults(res.data!.data);
      setPickerOpen(true);
    } catch {
      setProductResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const delay = window.setTimeout(() => void searchProducts(productQuery), 300);
    return () => window.clearTimeout(delay);
  }, [productQuery, searchProducts]);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  const addLine = (product: Product) => {
    setLines((current) => {
      const existing = current.find((line) => line.productId === product.id);
      if (existing) {
        return current.map((line) => (line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unitPrice: product.unit_price,
          availableStock: product.current_stock,
          quantity: 1,
        },
      ];
    });
    setProductQuery('');
    setPickerOpen(false);
  };

  const removeLine = (productId: number) => setLines((current) => current.filter((line) => line.productId !== productId));

  const setQuantity = (productId: number, raw: string) => {
    const quantity = Math.max(0, Math.min(Number(raw) || 0, lineMax(productId)));
    setLines((current) => current.map((line) => (line.productId === productId ? { ...line, quantity } : line)));
  };

  const lineMax = (productId: number) => {
    const line = lines.find((item) => item.productId === productId);
    if (!line) return 0;
    return Math.max(line.availableStock, line.quantity);
  };

  const handleCustomerCreated = (customer: Customer) => {
    setCustomerFormOpen(false);
    setCustomers((current) => [customer, ...current]);
    setCustomerId(String(customer.id));
    setCustomerError(null);
    toast.success(`${customer.business_name || customer.name} added — selected`);
  };

  const handleProductCreated = (product: Product) => {
    setProductFormOpen(false);
    addLine(product);
    toast.success(`${product.name} created and added to the challan`);
  };

  const submit = async (saveStatus: ChallanStatus) => {
    if (!customerId) {
      setCustomerError('Select a customer for this challan.');
      return;
    }
    if (lines.length === 0) {
      toast.error('Add at least one product to the challan.');
      return;
    }
    setSaving(true);
    setListError(null);
    try {
      const res = await api.post<Challan>('/challans', {
        customerId: Number(customerId),
        status: saveStatus,
        remarks: remarks.trim() || null,
        items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      });
      toast.success(saveStatus === 'CONFIRMED' ? 'Challan confirmed — stock deducted' : 'Draft challan saved');
      navigate(`/challans/${res.data!.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setListError(err.message);
        toast.error(err.message);
      } else {
        setListError('Unexpected error while saving the challan.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (!can('ADMIN', 'SALES')) return null;

  return (
    <div>
      <button className={styles.back} onClick={() => navigate('/challans')}>
        <ArrowLeftIcon /> Back to challans
      </button>

      <PageHeader title="New sales challan" description="Pick a customer, add products and quantities, then save as draft or confirm immediately." />

      <div className={styles.grid}>
        <div className={styles.main}>
          <Card className={styles.section}>
            <Card.Header
              title="Customer"
              description={customers.length === 0 ? 'No customers found' : `${customers.length} found — keep typing to refine`}
              actions={
                <Button variant="secondary" size="sm" icon={<PlusIcon />} onClick={() => setCustomerFormOpen(true)}>
                  New customer
                </Button>
              }
            />
            <div className={styles.sectionBody}>
              <Field label="Customer" required error={customerError ?? undefined}>
                <div className={styles.customerWrap}>
                  <Select
                    value={customerId}
                    onChange={(event) => {
                      setCustomerId(event.target.value);
                      setCustomerError(null);
                    }}
                    invalid={Boolean(customerError)}
                  >
                    <option value="">Select a customer…</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.business_name || customer.name}
                        {customer.name !== customer.business_name ? ` — ${customer.name}` : ''} ({customer.mobile})
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>
              <Field label="Quick filter customers">
                <Input value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Type name, business or mobile…" />
              </Field>
            </div>
          </Card>

          <Card className={styles.section}>
            <Card.Header
              title="Products"
              description="Search a product to add it as a line"
              actions={
                <Button variant="secondary" size="sm" icon={<PlusIcon />} onClick={() => setProductFormOpen(true)}>
                  New product
                </Button>
              }
            />
            <div className={styles.sectionBody}>
              <div className={styles.picker} ref={pickerRef}>
                <div className={styles.searchWrap}>
                  <SearchIcon />
                  <Input
                    value={productQuery}
                    onChange={(event) => setProductQuery(event.target.value)}
                    onFocus={() => setPickerOpen(true)}
                    placeholder="Search product name or SKU…"
                    aria-label="Search products"
                  />
                </div>
                {pickerOpen && (
                  <ul className={styles.results}>
                    {searching ? (
                      <li className={styles.resultEmpty}>Searching…</li>
                    ) : productResults.length === 0 ? (
                      <li className={styles.resultEmpty}>
                        No products match “{productQuery}”.
                        <Button type="button" variant="secondary" size="sm" icon={<PlusIcon />} onClick={() => setProductFormOpen(true)}>
                          Add a new product
                        </Button>
                      </li>
                    ) : (
                      productResults.map((product) => (
                        <li key={product.id}>
                          <button type="button" className={styles.result} onClick={() => addLine(product)}>
                            <span className={styles.resultName}>
                              {product.name}
                              <span className="mono text-muted">{product.sku}</span>
                            </span>
                            <span className={styles.resultMeta}>
                              <span className="mono">{formatMoney(product.unit_price)}</span>
                              <span className={product.is_low_stock ? styles.lowStock : styles.inStock}>
                                {product.current_stock} in stock
                              </span>
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              {lines.length === 0 ? (
                <p className={styles.noLines}>No products added yet.</p>
              ) : (
                <div className={styles.lines}>
                  <div className={styles.lineHead}>
                    <span>Product</span>
                    <span>Price</span>
                    <span>Stock</span>
                    <span>Qty</span>
                    <span>Amount</span>
                    <span />
                  </div>
                  {lines.map((line) => (
                    <div key={line.productId} className={styles.line}>
                      <span className={styles.lineName}>
                        {line.productName}
                        <span className="mono text-muted">{line.sku}</span>
                      </span>
                      <span className="mono">{formatMoney(line.unitPrice)}</span>
                      <span className={line.availableStock <= 0 ? styles.lowStock : ''}>{line.availableStock}</span>
                      <input
                        type="number"
                        min="1"
                        max={line.availableStock}
                        value={line.quantity}
                        onChange={(event) => setQuantity(line.productId, event.target.value)}
                        className={styles.qtyInput}
                      />
                      <span className="mono">{formatMoney(Number(line.unitPrice) * line.quantity)}</span>
                      <button type="button" className={styles.remove} onClick={() => removeLine(line.productId)} aria-label={`Remove ${line.productName}`}>
                        <XIcon />
                      </button>
                    </div>
                  ))}
                  <div className={styles.lineTotal}>
                    <span>{lines.length} line{lines.length === 1 ? '' : 's'}</span>
                    <span className="mono">
                      {totalQuantity} units · {formatMoney(totalValue)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {listError && <p className={styles.listError}>{listError}</p>}
        </div>

        <div className={styles.side}>
          <Card className={styles.section}>
            <Card.Header title="Delivery & save" />
            <div className={styles.sectionBody}>
              <Field label="Save as">
                <Select value={status} onChange={(event) => setStatus(event.target.value as ChallanStatus)}>
                  <option value="DRAFT">Draft — no stock change</option>
                  <option value="CONFIRMED">Confirmed — deduct stock now</option>
                </Select>
              </Field>
              <Field label="Remarks">
                <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional notes, delivery address, etc." />
              </Field>
              <dl className={styles.summary}>
                <div>
                  <dt>Products</dt>
                  <dd>{lines.length}</dd>
                </div>
                <div>
                  <dt>Total quantity</dt>
                  <dd className="mono">{totalQuantity}</dd>
                </div>
                <div>
                  <dt>Total value</dt>
                  <dd className="mono">{formatMoney(totalValue)}</dd>
                </div>
              </dl>
              <div className={styles.actions}>
                <Button variant="secondary" loading={saving} onClick={() => submit('DRAFT')} disabled={!customerId || lines.length === 0}>
                  Save draft
                </Button>
                <Button loading={saving} onClick={() => submit('CONFIRMED')} disabled={!customerId || lines.length === 0}>
                  Confirm & deduct stock
                </Button>
              </div>
              <p className={styles.hint}>Confirming checks stock availability and deducts inventory atomically. Drafts do not affect stock.</p>
            </div>
          </Card>
        </div>
      </div>

      <CustomerFormModal open={customerFormOpen} onClose={() => setCustomerFormOpen(false)} onSaved={handleCustomerCreated} />
      <ProductFormModal open={productFormOpen} onClose={() => setProductFormOpen(false)} onSaved={handleProductCreated} />
    </div>
  );
}