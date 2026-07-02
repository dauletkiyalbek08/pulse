import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { HeroLanding, type HeroSocials } from "@/components/hero-landing";
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
      "id, project_id, type, title, subtitle, bullets, button_text, thanks_text, accent, pixel_id, status, logo, start_button, questions, socials",
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
          landingId={landing.id}
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
  const socials =
    landing.socials && typeof landing.socials === "object" ? (landing.socials as HeroSocials) : {};

  return (
    <>
      {pixel}
      <HeroLanding
        token={token}
        landingId={landing.id}
        pixelId={landing.pixel_id}
        logo={landing.logo}
        title={landing.title}
        subtitle={landing.subtitle}
        bullets={bullets}
        buttonText={landing.button_text}
        thanksText={landing.thanks_text}
        accent={accent}
        socials={socials}
      />
    </>
  );
}
