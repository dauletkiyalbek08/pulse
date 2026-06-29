import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { LandingForm } from "@/components/landing-form";
import { QuizFunnel, type QuizSocials } from "@/components/quiz-funnel";
import { parseQuestions } from "@/lib/quiz-sample";

export const dynamic = "force-dynamic";

const PIXEL_BASE = (id: string) =>
  `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();
  const { data } = await admin.from("landings").select("title").eq("slug", slug).maybeSingle();
  return { title: data?.title ?? "Заявка" };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data: landing } = await admin
    .from("landings")
    .select(
      "project_id, type, title, subtitle, bullets, button_text, thanks_text, accent, pixel_id, status, logo, start_button, questions, socials",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (!landing || landing.status !== "active") notFound();

  const { data: project } = await admin
    .from("projects")
    .select("site_token")
    .eq("id", landing.project_id)
    .maybeSingle();

  const token = project?.site_token ?? "";
  const accent = landing.accent || "#16a34a";
  const pixel = landing.pixel_id ? (
    <script dangerouslySetInnerHTML={{ __html: PIXEL_BASE(landing.pixel_id) }} />
  ) : null;

  if (landing.type === "quiz") {
    const socials =
      landing.socials && typeof landing.socials === "object"
        ? (landing.socials as QuizSocials)
        : {};
    return (
      <>
        {pixel}
        <QuizFunnel
          token={token}
          pixelId={landing.pixel_id}
          logo={landing.logo}
          title={landing.title}
          subtitle={landing.subtitle}
          startButton={landing.start_button}
          questions={parseQuestions(landing.questions)}
          buttonText={landing.button_text}
          thanksText={landing.thanks_text}
          accent={accent}
          socials={socials}
        />
      </>
    );
  }

  const bullets = Array.isArray(landing.bullets) ? (landing.bullets as string[]) : [];

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      {pixel}
      <div className="mx-auto flex max-w-2xl flex-col items-stretch gap-8 px-5 py-12 sm:py-20">
        <div className="text-center">
          <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">{landing.title}</h1>
          {landing.subtitle && (
            <p className="mx-auto mt-3 max-w-xl text-lg text-gray-600">{landing.subtitle}</p>
          )}
        </div>

        {bullets.length > 0 && (
          <ul className="mx-auto grid w-full max-w-md gap-2.5">
            {bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[15px] text-gray-700">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: accent }}
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
                {b}
              </li>
            ))}
          </ul>
        )}

        <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-6 shadow-lg ring-1 ring-gray-100 sm:p-8">
          <LandingForm
            token={token}
            pixelId={landing.pixel_id}
            buttonText={landing.button_text}
            thanksText={landing.thanks_text}
            accent={accent}
          />
        </div>
      </div>
    </main>
  );
}
