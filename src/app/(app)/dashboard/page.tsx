import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { accessibleAreas, AREAS, ROLE_LABELS, type Area } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

const AREA_DESCRIPTIONS: Record<Area, string> = {
  admin: "Users, courses, settings, insights and the audit log.",
  office: "Student records, enrollments, invoices and reports.",
  teach: "Your classes, course content, grading and attendance.",
  learn: "Your classes, lessons, quizzes and grades.",
  guardian: "Progress, grades and attendance of your students.",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const areas = accessibleAreas(user.roles);
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader title={`Welcome, ${firstName}`} description="Here's where you can go from here." />
      <div className="mb-6 flex flex-wrap gap-2">
        {user.roles.map((role) => (
          <Badge key={role} variant="secondary">
            {ROLE_LABELS[role]}
          </Badge>
        ))}
      </div>

      {areas.length === 0 ? (
        <p className="text-muted-foreground">
          Your account has no role yet. Ask an administrator to assign one.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {areas.map((area) => (
            <Link key={area} href={AREAS[area].path} className="group rounded-xl focus-visible:outline-none">
              <Card className="h-full transition-colors group-hover:bg-accent/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {AREAS[area].label}
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardTitle>
                  <CardDescription>{AREA_DESCRIPTIONS[area]}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
