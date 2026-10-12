import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/native-select";
import { toDateInput } from "@/lib/zod";
import { STUDENT_STATUS_LABELS, STUDENT_STATUSES } from "../schemas";

export type StudentDefaults = {
  name?: string;
  email?: string;
  phone?: string | null;
  studentCode?: string;
  birthDate?: Date | null;
  documentId?: string | null;
  address?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  medicalNotes?: string | null;
  enrollmentDate?: Date | null;
  status?: string;
  officeNotes?: string | null;
};

type Errors = Record<string, string[] | undefined> | undefined;

/** The student record fields, grouped. Used by the create and edit forms. */
export function StudentFields({ defaults = {}, errors }: { defaults?: StudentDefaults; errors: Errors }) {
  const v = (s: string | null | undefined) => s ?? "";
  return (
    <div className="grid gap-6">
      <section className="grid gap-4" aria-labelledby="personal-heading">
        <h3 id="personal-heading" className="text-sm font-semibold">Personal</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="name" label="Full name" error={errors?.name}>
            <Input id="name" name="name" defaultValue={v(defaults.name)} autoComplete="off" />
          </FormField>
          <FormField id="email" label="Email" error={errors?.email} hint="Used to sign in.">
            <Input id="email" name="email" type="email" defaultValue={v(defaults.email)} autoComplete="off" />
          </FormField>
          <FormField id="phone" label="Phone" error={errors?.phone}>
            <Input id="phone" name="phone" type="tel" defaultValue={v(defaults.phone)} />
          </FormField>
          <FormField id="birthDate" label="Birth date" error={errors?.birthDate}>
            <Input id="birthDate" name="birthDate" type="date" defaultValue={toDateInput(defaults.birthDate)} />
          </FormField>
          <FormField id="documentId" label="ID document number" error={errors?.documentId}>
            <Input id="documentId" name="documentId" defaultValue={v(defaults.documentId)} />
          </FormField>
          <FormField id="address" label="Address" error={errors?.address}>
            <Input id="address" name="address" defaultValue={v(defaults.address)} />
          </FormField>
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="enrollment-heading">
        <h3 id="enrollment-heading" className="text-sm font-semibold">Enrollment</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="studentCode" label="Student code" error={errors?.studentCode} hint="Leave empty to generate one.">
            <Input id="studentCode" name="studentCode" defaultValue={v(defaults.studentCode)} />
          </FormField>
          <FormField id="enrollmentDate" label="Enrollment date" error={errors?.enrollmentDate} hint="Defaults to today.">
            <Input id="enrollmentDate" name="enrollmentDate" type="date" defaultValue={toDateInput(defaults.enrollmentDate)} />
          </FormField>
          <FormField id="status" label="Status" error={errors?.status}>
            <NativeSelect id="status" name="status" defaultValue={defaults.status ?? "ACTIVE"}>
              {STUDENT_STATUSES.map((s) => (
                <option key={s} value={s}>{STUDENT_STATUS_LABELS[s]}</option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </section>

      <section className="grid gap-4" aria-labelledby="emergency-heading">
        <h3 id="emergency-heading" className="text-sm font-semibold">Emergency & health</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="emergencyContactName" label="Emergency contact" error={errors?.emergencyContactName}>
            <Input id="emergencyContactName" name="emergencyContactName" defaultValue={v(defaults.emergencyContactName)} />
          </FormField>
          <FormField id="emergencyContactPhone" label="Emergency phone" error={errors?.emergencyContactPhone}>
            <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" defaultValue={v(defaults.emergencyContactPhone)} />
          </FormField>
        </div>
        <FormField
          id="medicalNotes"
          label="Medical notes"
          error={errors?.medicalNotes}
          hint="Confidential: visible to office staff and administrators only."
        >
          <Textarea id="medicalNotes" name="medicalNotes" rows={3} defaultValue={v(defaults.medicalNotes)} />
        </FormField>
      </section>

      <FormField id="officeNotes" label="Office notes" error={errors?.officeNotes} hint="Internal; never shown to the student.">
        <Textarea id="officeNotes" name="officeNotes" rows={3} defaultValue={v(defaults.officeNotes)} />
      </FormField>
    </div>
  );
}
