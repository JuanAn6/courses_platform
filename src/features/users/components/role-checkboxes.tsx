import { ROLE_LABELS, ROLES, type Role } from "@/lib/auth/permissions";

const ROLE_HINTS: Record<Role, string> = {
  ADMIN: "Full access to everything",
  SECRETARY: "Student records, enrollments, payments",
  TEACHER: "Teaches and edits assigned classes",
  ASSISTANT: "Grades and takes attendance in assigned classes",
  STUDENT: "Takes classes",
  GUARDIAN: "Follows linked students",
};

export function RoleCheckboxes({
  defaultRoles = [],
  error,
  roles = ROLES,
}: {
  defaultRoles?: readonly Role[];
  error?: string[];
  roles?: readonly Role[];
}) {
  return (
    <fieldset className="grid gap-2" aria-describedby={error ? "roles-error" : undefined}>
      <legend className="mb-1 text-sm font-medium">Roles</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {roles.map((role) => (
          <label key={role} className="flex items-start gap-2 rounded-md border p-2 text-sm has-checked:border-primary has-checked:bg-accent/50">
            <input
              type="checkbox"
              name="roles"
              value={role}
              defaultChecked={defaultRoles.includes(role)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              <span className="font-medium">{ROLE_LABELS[role]}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_HINTS[role]}</span>
            </span>
          </label>
        ))}
      </div>
      {error?.[0] ? (
        <p id="roles-error" className="text-sm text-destructive">{error[0]}</p>
      ) : null}
    </fieldset>
  );
}
