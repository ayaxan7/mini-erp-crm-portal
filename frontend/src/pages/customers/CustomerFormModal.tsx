import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select, Textarea } from '../../components/ui/Field';
import { api } from '../../services/api';
import { ApiError } from '../../types/api';
import type { Customer, CustomerFormValues, CustomerStatus, CustomerType } from '../../types/domain';
import { useToast } from '../../components/ui/Toast';
import styles from './CustomerForms.module.css';

interface Props {
  open: boolean;
  customer?: Customer | null;
  onClose: () => void;
  onSaved: (customer: Customer) => void;
}

const EMPTY: CustomerFormValues = {
  name: '',
  mobile: '',
  email: '',
  businessName: '',
  gstNumber: '',
  type: 'RETAIL',
  address: '',
  status: 'LEAD',
  followUpDate: '',
  notes: '',
};

type FieldName = keyof CustomerFormValues;

function validate(values: CustomerFormValues): Partial<Record<FieldName, string>> {
  const errors: Partial<Record<FieldName, string>> = {};
  if (!values.name.trim()) errors.name = 'Name is required';
  if (!values.mobile.trim()) errors.mobile = 'Mobile number is required';
  else if (!/^[0-9+\-\s]{7,15}$/.test(values.mobile.trim())) errors.mobile = 'Enter a valid mobile number';
  if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) errors.email = 'Enter a valid email address';
  if (values.gstNumber.trim() && !/^[0-9A-Za-z]{15}$/.test(values.gstNumber.trim())) errors.gstNumber = 'GST must be 15 characters';
  return errors;
}

export function CustomerFormModal({ open, customer, onClose, onSaved }: Props) {
  const [values, setValues] = useState<CustomerFormValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setValues(
        customer
          ? {
              name: customer.name,
              mobile: customer.mobile,
              email: customer.email ?? '',
              businessName: customer.business_name ?? '',
              gstNumber: customer.gst_number ?? '',
              type: customer.type,
              address: customer.address ?? '',
              status: customer.status,
              followUpDate: customer.follow_up_date ?? '',
              notes: customer.notes ?? '',
            }
          : EMPTY,
      );
      setErrors({});
      setFormError(null);
    }
  }, [open, customer]);

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
      const payload = {
        name: values.name.trim(),
        mobile: values.mobile.trim(),
        email: values.email.trim() || null,
        businessName: values.businessName.trim() || null,
        gstNumber: values.gstNumber.trim() || null,
        type: values.type as CustomerType,
        address: values.address.trim() || null,
        status: values.status as CustomerStatus,
        followUpDate: values.followUpDate || null,
        notes: values.notes.trim() || null,
      };
      const res = customer
        ? await api.patch<Customer>(`/customers/${customer.id}`, payload)
        : await api.post<Customer>('/customers', payload);
      toast.success(customer ? 'Customer updated' : 'Customer created');
      onSaved(res.data!);
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
      title={customer ? `Edit ${customer.name}` : 'Add customer'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            {customer ? 'Save changes' : 'Create customer'}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={submit} noValidate className={styles.grid}>
        <Field label="Customer name" required error={errors.name}>
          <Input value={values.name} onChange={(event) => set('name', event.target.value)} invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Mobile number" required error={errors.mobile}>
          <Input value={values.mobile} onChange={(event) => set('mobile', event.target.value)} invalid={Boolean(errors.mobile)} />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={values.email} onChange={(event) => set('email', event.target.value)} invalid={Boolean(errors.email)} placeholder="Optional" />
        </Field>
        <Field label="Business name">
          <Input value={values.businessName} onChange={(event) => set('businessName', event.target.value)} placeholder="Optional" />
        </Field>
        <Field label="GST number" error={errors.gstNumber}>
          <Input value={values.gstNumber} onChange={(event) => set('gstNumber', event.target.value)} invalid={Boolean(errors.gstNumber)} placeholder="Optional" />
        </Field>
        <Field label="Customer type" required>
          <Select value={values.type} onChange={(event) => set('type', event.target.value)}>
            <option value="RETAIL">Retail</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="DISTRIBUTOR">Distributor</option>
          </Select>
        </Field>
        <Field label="Status" required>
          <Select value={values.status} onChange={(event) => set('status', event.target.value)}>
            <option value="LEAD">Lead</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </Field>
        <Field label="Follow-up date" hint="Next scheduled follow-up">
          <Input type="date" value={values.followUpDate} onChange={(event) => set('followUpDate', event.target.value)} />
        </Field>
        <Field label="Address" className={styles.span2}>
          <Input value={values.address} onChange={(event) => set('address', event.target.value)} />
        </Field>
        <Field label="Notes" className={styles.span2}>
          <Textarea value={values.notes} onChange={(event) => set('notes', event.target.value)} />
        </Field>
        {formError && <p className={`${styles.formError} ${styles.span2}`}>{formError}</p>}
      </form>
    </Modal>
  );
}