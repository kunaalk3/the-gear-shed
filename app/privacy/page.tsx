import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | ComRes",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Legal</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Privacy Policy</h1>
      <p className="mt-1 font-tag text-xs uppercase tracking-wide text-ink/50">
        Community Resource Network SA equipment sharing platform &middot; Last updated 20 September 2026
      </p>

      <div className="mt-4 rounded-lg border border-dashed border-brick/60 bg-brick/5 p-4 font-body text-sm text-ink/80">
        This is a project draft for the CRN&nbsp;SA website prototype (ComRes). It must be reviewed and completed
        by the real Platform operator before public launch, particularly the operator identity, contact details,
        service-provider disclosures, overseas handling and retention periods.
      </div>

      <p className="mt-6 font-body leading-relaxed text-ink/80">
        This Privacy Policy explains how the CRN&nbsp;SA website prototype collects, uses, stores and discloses
        personal information when individuals and organisations create accounts, list equipment, request items or
        communicate through the Platform.
      </p>

      <Section n="1" title="Scope">
        <P>
          This policy applies to personal information handled through the Community Resource Network SA platform,
          referred to as &ldquo;CRN&nbsp;SA&rdquo;, &ldquo;the Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;
          or &ldquo;our&rdquo;. It should be read with the{" "}
          <Link href="/terms" className="font-semibold text-pine underline underline-offset-2">
            Terms and Conditions
          </Link>
          .
        </P>
        <P>
          CRN&nbsp;SA is currently a university project prototype and is not represented as a registered operating
          company. Before any real-world launch, the operator must insert its legal name, contact details and any
          other information required by applicable law.
        </P>
      </Section>

      <Section n="2" title="Information we collect">
        <P>Depending on how you use the Platform, we may collect:</P>
        <Ul
          items={[
            "account details, including name, email address, phone number and password credentials stored in protected form",
            "organisation details, including organisation name, contact person, registration information, address and approval documents",
            "equipment listing information, photographs, condition records, availability, fees and collection or delivery preferences",
            "booking information, including requested equipment, dates, quantity, status, provider decisions, cancellation reasons and return records",
            "payment-related information, transaction status and payment references, while payment-card details may be handled directly by a payment provider",
            "communications, support requests, complaints, ratings and reviews",
            "technical information such as device, browser, IP address, timestamps, security logs and website usage information",
          ]}
        />
      </Section>

      <Section n="3" title="How we collect information">
        <P>
          We collect information directly from users when they register, submit forms, list equipment, make or
          manage a request, upload content, provide feedback or contact support. We may also receive transaction
          or technical information from service providers used to operate the Platform.
        </P>
      </Section>

      <Section n="4" title="Why we use information">
        <P>We may use personal information to:</P>
        <Ul
          items={[
            "create and manage accounts",
            "review and approve organisation or Provider registrations",
            "publish equipment listings and manage availability",
            "route requests to the organisation that owns the equipment",
            "support booking approval, payment, collection, return, cancellation and dispute processes",
            "send account, request and transaction notifications",
            "display verified transaction reviews",
            "protect users, prevent fraud and maintain Platform security",
            "troubleshoot and improve the Platform",
            "meet legal, regulatory or record-keeping obligations",
          ]}
        />
      </Section>

      <Section n="5" title="Information shared with other users">
        <P>
          Information necessary to complete a transaction may be shared between the relevant Provider and
          Requester. This may include names, organisation details, booking details, contact information and
          agreed collection or return arrangements.
        </P>
        <P>
          Users must only use another person&rsquo;s information for the relevant Platform transaction and must
          not use it for unsolicited marketing or unrelated purposes.
        </P>
      </Section>

      <Section n="6" title="Service providers and disclosures">
        <P>
          We may disclose information to service providers that support website hosting, database storage, image
          storage, authentication, communications, analytics, security and payment processing. The prototype uses
          Vercel for deployment, PostgreSQL for relational data and Vercel Blob for images. A selected payment
          provider should be added here before payment functionality is launched.
        </P>
        <P>
          We may also disclose information where required by law, to respond to lawful requests, to protect safety
          or rights, or with the user&rsquo;s consent. We do not sell personal information.
        </P>
      </Section>

      <Section n="7" title="Storage, security and retention">
        <P>
          We take reasonable technical and organisational measures to protect information from unauthorised
          access, loss, misuse or disclosure. No online service can guarantee absolute security.
        </P>
        <P>
          Information should be retained only for as long as needed for Platform operations, transaction records,
          dispute handling, security and legal obligations. The production operator must approve and publish a
          specific retention schedule before real-world launch.
        </P>
      </Section>

      <Section n="8" title="Cookies and technical data">
        <P>
          The Platform may use essential cookies or similar technologies for login sessions, security and core
          website functions. If analytics, advertising or non-essential cookies are introduced, this policy and
          any required consent controls must be updated before those technologies are used.
        </P>
      </Section>

      <Section n="9" title="Access, correction and account requests">
        <P>
          Users may request access to or correction of their personal information by using available account
          controls or contacting CRN&nbsp;SA. Identity verification may be required before a request is completed.
        </P>
        <P>
          Users may also request account closure. Some transaction, security or legal records may need to be
          retained after an account is closed.
        </P>
      </Section>

      <Section n="10" title="Privacy complaints">
        <P>Privacy questions or complaints may be sent to:</P>
        <P className="font-tag text-xs uppercase tracking-wide text-ink/60">
          Community Resource Network SA &middot; Email: [insert privacy contact email] &middot; Phone: [insert
          phone number] &middot; Address: [insert postal address]
        </P>
        <P>
          We will acknowledge and review a complaint within a reasonable period. If a person is not satisfied with
          the response, they may contact the Office of the Australian Information Commissioner or another
          appropriate authority.
        </P>
      </Section>

      <Section n="11" title="Overseas handling">
        <P>
          Some service providers may store or process information outside Australia. Before real-world launch, the
          operator must confirm the locations used by its service providers and describe any overseas disclosures
          required by applicable privacy obligations.
        </P>
      </Section>

      <Section n="12" title="Changes to this policy">
        <P>
          We may update this policy when Platform features, service providers or legal requirements change. The
          current version and effective date will be published on the Platform. Material changes will be
          communicated where reasonably appropriate.
        </P>
      </Section>

      <div className="mt-10 rounded-lg border border-dashed border-canvas-line p-4 font-body text-xs text-ink/50">
        This policy is read together with the{" "}
        <Link href="/terms" className="font-semibold text-pine underline underline-offset-2">
          Terms and Conditions
        </Link>
        .
      </div>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-canvas-line pt-6">
      <h2 className="font-display text-xl font-bold text-pine">
        <span className="text-pine/40">{n}.</span> {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function P({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`mt-2 font-body leading-relaxed text-ink/80 ${className}`}>{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 font-body leading-relaxed text-ink/80">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
