import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Field, Input, Select, Textarea } from '../components/ui/Field';
import { api } from '../services/api';
import { ApiError } from '../types/api';
import { useToast } from '../components/ui/Toast';
import { REQUESTABLE_ROLES, type Role } from '../types/domain';
import styles from './RequestAccess.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

interface Values {
  name: string;
  email: string;
  role: Role;
  message: string;
}

type FieldName = keyof Values;

const EMPTY: Values = { name: '', email: '', role: 'SALES', message: '' };

export function RequestAccessModal({ open, onClose, onSubmitted }: Props) {
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setValues(EMPTY);
      setErrors({});
      setFormError(null);
    }
  }, [open]);

  const set = (field: FieldName, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Partial<Record<FieldName, string>> = {};
    if (!values.name.trim()) next.name = 'Name is required';
    else if (values.name.trim().length < 2) next.name = 'Enter your full name';
    if (!values.email.trim()) next.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) next.email = 'Enter a valid email address';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    setFormError(null);
    try {
      await api.post('/auth/request-access', {
        name: values.name.trim(),
        email: values.email.trim(),
        role: values.role,
        message: values.message.trim() || null,
      });
      toast.success('Request submitted — an admin will review it.');
      onSubmitted();
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
      size="md"
      title="Request access"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving}>
            Submit request
          </Button>
        </>
      }
    >
      <form id="request-access-form" onSubmit={submit} noValidate>
        <Field label="Full name" required error={errors.name}>
          <Input value={values.name} onChange={(event) => set('name', event.target.value)} invalid={Boolean(errors.name)} placeholder="e.g. Priya Nair" />
        </Field>
        <Field label="Work email" required error={errors.email}>
          <Input type="email" value={values.email} onChange={(event) => set('email', event.target.value)} invalid={Boolean(errors.email)} placeholder="you@company.com" />
        </Field>
        <Field label="Role" required>
          <Select value={values.role} onChange={(event) => set('role', event.target.value)}>
            {REQUESTABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0) + role.slice(1).toLowerCase()}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Why do you need access?" hint="Optional — helps the admin decide.">
          <Textarea value={values.message} onChange={(event) => set('message', event.target.value)} />
        </Field>
        <p className={styles.note}>
          An admin will review your request. If approved, you will receive a temporary password to sign in.
        </p>
        {formError && <p className={styles.formError}>{formError}</p>}
      </form>
    </Modal>
  );
}
