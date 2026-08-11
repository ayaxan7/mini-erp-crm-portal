import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Field';
import { api, uploadImage } from '../../services/api';
import { ApiError } from '../../types/api';
import type { Product, ProductFormValues } from '../../types/domain';
import { useToast } from '../../components/ui/Toast';
import { ImageIcon } from '../../components/ui/Icons';
import styles from './ProductForms.module.css';

interface Props {
  open: boolean;
  product?: Product | null;
  onClose: () => void;
  onSaved: (product: Product) => void;
}

const EMPTY: ProductFormValues = {
  name: '',
  sku: '',
  category: 'General',
  unitPrice: '',
  currentStock: '',
  minStock: '0',
  location: '',
};

type FieldName = keyof ProductFormValues;

function validate(values: ProductFormValues): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  if (!values.name.trim()) errors.name = 'Product name is required';
  if (!values.sku.trim()) errors.sku = 'SKU is required';
  else if (!/^[A-Za-z0-9\-_ ]+$/.test(values.sku.trim())) errors.sku = 'Only letters, numbers, dashes and spaces';
  if (values.unitPrice === '' || Number.isNaN(Number(values.unitPrice)) || Number(values.unitPrice) < 0)
    errors.unitPrice = 'Enter a valid unit price';
  if (values.minStock !== '' && (Number.isNaN(Number(values.minStock)) || Number(values.minStock) < 0))
    errors.minStock = 'Enter a valid minimum stock';
  if (values.currentStock !== '' && (Number.isNaN(Number(values.currentStock)) || Number(values.currentStock) < 0))
    errors.currentStock = 'Enter a valid opening stock';
  return errors;
}

export function ProductFormModal({ open, product, onClose, onSaved }: Props) {
  const [values, setValues] = useState<ProductFormValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setValues(
        product
          ? {
              name: product.name,
              sku: product.sku,
              category: product.category,
              unitPrice: product.unit_price,
              currentStock: '',
              minStock: String(product.min_stock),
              location: product.location ?? '',
            }
          : EMPTY,
      );
      setErrors({});
      setFormError(null);
      setImageFile(null);
      setImageError(null);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setImagePreview(product?.image_url ?? null);
    }
  }, [open, product]);

  const handleImageFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setImageError('Only PNG, JPEG or WebP images are allowed.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Image must be 5 MB or smaller.');
      return;
    }
    setImageError(null);
    setImageFile(file);
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = URL.createObjectURL(file);
    setImagePreview(blobUrlRef.current);
  };

  const clearImage = () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
    setImageFile(null);
    setImageError(null);
    setImagePreview(product?.image_url ?? null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const set = (field: FieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = validate(values);
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setFormError(null);
    try {
      const base = {
        name: values.name.trim(),
        sku: values.sku.trim(),
        category: values.category.trim() || null,
        unitPrice: Number(values.unitPrice),
        minStock: values.minStock === '' ? 0 : Number(values.minStock),
        location: values.location.trim() || null,
      };
      let res;
      if (product) {
        res = await api.patch<Product>(`/products/${product.id}`, base);
      } else {
        res = await api.post<Product>('/products', {
          ...base,
          currentStock: values.currentStock === '' ? 0 : Number(values.currentStock),
        });
      }
      let saved = res.data!;
      if (imageFile) {
        try {
          const imageRes = await uploadImage<Product>(`/products/${saved.id}/image`, imageFile);
          saved = imageRes.data!;
        } catch (imageErr) {
          toast.error(
            imageErr instanceof ApiError ? `Product saved, but image upload failed: ${imageErr.message}` : 'Product saved, but image upload failed',
          );
          onSaved(saved);
          return;
        }
      }
      toast.success(product ? 'Product updated' : 'Product created');
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        if (err.errors) {
          const byField: Partial<Record<FieldName, string>> = {};
          for (const item of err.errors) byField[item.field as FieldName] = item.message;
          setErrors(byField);
        }
      } else {
        setFormError('Unexpected error. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={product ? `Edit ${product.name}` : 'Add product'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {product ? 'Save changes' : 'Create product'}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit} noValidate className={styles.grid}>
        <Field label="Product name" required error={errors.name}>
          <Input value={values.name} onChange={(event) => set('name', event.target.value)} invalid={Boolean(errors.name)} />
        </Field>
        <Field label="SKU" required error={errors.sku} hint={product ? 'SKU cannot be changed' : 'Auto-uppercased, must be unique'}>
          <Input value={values.sku} onChange={(event) => set('sku', event.target.value.toUpperCase())} invalid={Boolean(errors.sku)} disabled={Boolean(product)} />
        </Field>
        <Field label="Category" >
          <Input value={values.category} onChange={(event) => set('category', event.target.value)} placeholder="General" />
        </Field>
        <Field label="Unit price (₹)" required error={errors.unitPrice}>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={values.unitPrice}
            onChange={(event) => set('unitPrice', event.target.value)}
            invalid={Boolean(errors.unitPrice)}
          />
        </Field>
        <Field label="Minimum stock" error={errors.minStock}>
          <Input type="number" min="0" value={values.minStock} onChange={(event) => set('minStock', event.target.value)} invalid={Boolean(errors.minStock)} />
        </Field>
        <Field label="Opening stock" error={errors.currentStock} hint={product ? 'Use the stock form on the product page' : 'Initial stock level (creates a stock IN record)'}>
          <Input type="number" min="0" value={values.currentStock} onChange={(event) => set('currentStock', event.target.value)} invalid={Boolean(errors.currentStock)} disabled={Boolean(product)} />
        </Field>
        <Field label="Storage location">
          <Input value={values.location} onChange={(event) => set('location', event.target.value)} placeholder="e.g. Rack A-3" />
        </Field>
        <Field label="Product image" hint="Optional — PNG, JPEG or WebP up to 5 MB" error={imageError ?? undefined} className={styles.imageField}>
          <div className={styles.imagePicker}>
            {imagePreview ? (
              <img className={styles.imagePreview} src={imagePreview} alt="Product preview" />
            ) : (
              <span className={`${styles.imagePreview} ${styles.imagePlaceholder}`}>
                <ImageIcon width={22} height={22} />
              </span>
            )}
            <div className={styles.imageActions}>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => fileInputRef.current?.click()}>
                {imagePreview ? 'Change image' : 'Choose image'}
              </Button>
              {imagePreview && (
                <Button type="button" variant="ghost" disabled={saving} onClick={clearImage}>
                  Clear
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className={styles.hiddenInput}
                onChange={(event) => handleImageFile(event)}
              />
            </div>
          </div>
        </Field>
        {formError && <p className={styles.formError}>{formError}</p>}
      </form>
    </Modal>
  );
}