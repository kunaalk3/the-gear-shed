import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions | ComRes",
};

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12">
      <p className="font-tag text-xs uppercase tracking-widest text-pine/70">Legal</p>
      <h1 className="mt-1 font-display text-4xl font-bold text-pine">Terms and Conditions</h1>
      <p className="mt-1 font-tag text-xs uppercase tracking-wide text-ink/50">
        Community Resource Network SA equipment sharing platform &middot; Last updated 20 September 2026
      </p>

      <div className="mt-4 rounded-lg border border-dashed border-brick/60 bg-brick/5 p-4 font-body text-sm text-ink/80">
        This document is a project draft prepared for the CRN&nbsp;SA website prototype (ComRes). Before any
        real-world launch, CRN&nbsp;SA should replace all bracketed contact details and obtain review from a
        qualified Australian legal adviser. It is intended to preserve rights that cannot legally be excluded
        under Australian Consumer Law and should be read together with the{" "}
        <Link href="/privacy" className="font-semibold text-pine underline underline-offset-2">
          Privacy Policy
        </Link>
        .
      </div>

      <p className="mt-6 font-body leading-relaxed text-ink/80">
        These Terms explain how individuals, organisations and approved equipment providers may use the CRN&nbsp;SA
        platform for paid hire, temporary free loans and permanent donations. They also explain booking approval,
        payment, collection, safe use, liability and dispute responsibilities.
      </p>

      <Section n="1" title="About these Terms">
        <P>
          These Terms and Conditions govern your access to and use of the Community Resource Network SA platform,
          referred to in these Terms as &ldquo;CRN&nbsp;SA&rdquo;, &ldquo;the Platform&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo; or &ldquo;our&rdquo;.
        </P>
        <P>The Platform allows registered organisations and other approved providers to list equipment for:</P>
        <Ul items={["paid hire", "temporary free loan", "permanent donation"]} />
        <P>
          Individuals and organisations using the Platform to request equipment are referred to as
          &ldquo;Requesters&rdquo;. Organisations or other approved users listing equipment are referred to as
          &ldquo;Providers&rdquo;.
        </P>
        <P>
          By creating an account, submitting a request, listing equipment or otherwise using the Platform, you
          agree to these Terms and our{" "}
          <Link href="/privacy" className="font-semibold text-pine underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </P>
      </Section>

      <Section n="2" title="Eligibility and accounts">
        <P>
          You must be at least 18 years old to create an individual account or enter into a booking. If you
          register or transact for an organisation, you confirm that you are authorised to act for that
          organisation.
        </P>
        <P>
          You must provide accurate and current information when registering and must update your information if
          it changes.
        </P>
        <P>You are responsible for:</P>
        <Ul
          items={[
            "keeping your login details confidential",
            "all activity performed through your account",
            "notifying CRN SA if you believe your account has been accessed without permission",
            "ensuring that you are authorised to act for an organisation when registering on its behalf",
          ]}
        />
        <P>
          We may verify account information and require additional documents before approving a Provider account
          or equipment listing. Provider approval by CRN&nbsp;SA does not mean that CRN&nbsp;SA guarantees or
          endorses the Provider, its equipment or its services.
        </P>
      </Section>

      <Section n="3" title="Role of CRN SA">
        <P>
          CRN&nbsp;SA provides the online Platform through which Providers and Requesters can connect. For each
          equipment transaction, the agreement for hire, loan or donation is between the relevant Provider and
          Requester. CRN&nbsp;SA facilitates the transaction through the Platform but is not a party to that
          equipment agreement, except in relation to the Platform services it provides.
        </P>
        <P>The relevant Provider, not CRN&nbsp;SA:</P>
        <Ul
          items={[
            "owns or controls the listed equipment",
            "determines whether a request is approved or rejected",
            "provides the description and photographs of the equipment",
            "determines availability, collection and return arrangements",
            "sets any hire fee, deposit or other permitted charge",
            "confirms the equipment's condition and suitability",
            "remains responsible for the quality, safety and accuracy of its listing",
          ]}
        />
        <P>
          Unless expressly stated otherwise, CRN&nbsp;SA is not the owner, seller, lessor, lender or donor of
          equipment listed by Providers.
        </P>
        <P>
          Providers are responsible for maintaining any insurance, registration, inspection, licence or approval
          required by law for the equipment they list. Requesters remain responsible for holding any licence,
          qualification or training required to use the equipment.
        </P>
      </Section>

      <Section n="4" title="Equipment listings">
        <P>Providers must ensure that each listing is accurate and includes, where applicable:</P>
        <Ul
          items={[
            "a clear equipment description",
            "current photographs",
            "quantity available",
            "equipment condition",
            "hire, loan or donation type",
            "hire fees and deposits",
            "availability dates",
            "collection and return arrangements",
            "cancellation conditions",
            "usage restrictions",
            "any safety instructions or known defects",
          ]}
        />
        <P>
          Providers must not list illegal, stolen, unsafe, recalled, counterfeit or misleadingly described
          equipment. CRN&nbsp;SA may review, reject, suspend or remove a listing that does not meet Platform
          requirements.
        </P>
      </Section>

      <Section n="5" title="Requests and Provider approval">
        <P>Submitting an equipment request does not automatically confirm a booking. A booking is only confirmed after:</P>
        <Ol
          items={[
            "the Requester submits the required dates, quantity and other requested details",
            "the relevant Provider approves the request",
            "any required payment or deposit is completed",
            "confirmation is displayed or sent through the Platform",
          ]}
        />
        <P>
          The Provider, not CRN&nbsp;SA, approves or rejects equipment requests. Displayed availability is
          indicative and may change before confirmation. A booking is not guaranteed until the relevant Provider
          approves the request and the Platform issues confirmation. Users must review the final booking details
          carefully.
        </P>
      </Section>

      <Section n="6" title="Acceptance before booking">
        <P>
          Before submitting a booking request, the Requester must actively accept the current Terms and
          Conditions through the checkbox displayed by the Platform. By selecting the acceptance checkbox and
          submitting the request, the Requester confirms that they have read, understood and agreed to the
          current Terms and Conditions.
        </P>
        <P>By accepting, the Requester confirms that they:</P>
        <Ul
          items={[
            "have reviewed the listing and booking details",
            "understand the applicable fees, deposit and cancellation conditions",
            "will use the equipment responsibly and only for its intended purpose",
            "accept responsibility for loss or damage caused by misuse, negligence or unauthorised use, subject to applicable law",
            "understand that the Provider, not CRN SA, is responsible for the equipment's description, quality and condition",
          ]}
        />
      </Section>

      <Section n="7" title="Paid hire, free loans and donations">
        <p className="mt-2 font-tag text-xs uppercase tracking-wide text-ink/50">Paid hire</p>
        <P>
          For paid hire, the Requester must pay the displayed hire fee, deposit and any other clearly disclosed
          charge.
        </P>
        <p className="mt-3 font-tag text-xs uppercase tracking-wide text-ink/50">Temporary free loans</p>
        <P>
          A temporary free loan does not transfer ownership. The Requester must return the equipment to the
          Provider by the agreed date and in substantially the same condition, allowing for reasonable wear and
          tear.
        </P>
        <p className="mt-3 font-tag text-xs uppercase tracking-wide text-ink/50">Permanent donations</p>
        <P>
          For a permanent donation, ownership transfers when the recipient accepts and takes possession of the
          equipment, unless the Provider and recipient agree in writing to another transfer point. Donated
          equipment is not required to be returned, and its condition must match the description provided,
          subject to any rights that cannot legally be excluded.
        </P>
        <P>The Provider must clearly identify whether an item is offered for paid hire, free loan or permanent donation.</P>
      </Section>

      <Section n="8" title="Payments, deposits and refunds">
        <P>
          Payments may be processed through a third-party payment service. Additional terms imposed by that
          payment provider may apply. Before payment, the Platform or Provider must clearly display:
        </P>
        <Ul
          items={[
            "the hire fee",
            "the deposit",
            "any applicable transaction charge",
            "the total payable amount",
            "the relevant refund or cancellation conditions",
          ]}
        />
        <P>
          A deposit may only be retained for an amount reasonably connected to disclosed unpaid charges, late
          return, loss or damage. The Provider must support any deduction with reasonable evidence, such as dated
          condition photographs, repair quotations or replacement costs.
        </P>
        <P>
          The Requester may dispute a proposed deduction through the Platform or the published support contact.
          Any undisputed balance should be returned promptly after the equipment has been returned and inspected.
          CRN&nbsp;SA may assist communication but does not determine private legal liability unless required by
          law.
        </P>
        <P>
          Refunds must be processed according to the applicable cancellation policy and Australian Consumer Law.
          Nothing in these Terms removes any refund or other remedy that cannot lawfully be excluded. Cash
          payments or direct bank transfers must only be used where they are offered and agreed upon by the
          Provider.
        </P>
      </Section>

      <Section n="9" title="Collection, delivery and return">
        <P>The Provider and Requester are responsible for confirming:</P>
        <Ul
          items={[
            "the collection or delivery location",
            "the collection date and time",
            "the person authorised to collect the equipment",
            "the return location, date and time",
            "any transport or handling requirements",
          ]}
        />
        <P>
          Both parties should inspect the equipment during handover and record any existing damage. Photographs
          may be uploaded as evidence of the equipment&rsquo;s condition. A Requester must not collect equipment
          unless the booking is confirmed.
        </P>
      </Section>

      <Section n="10" title="Safe and permitted use">
        <P>Requesters must:</P>
        <Ul
          items={[
            "use equipment only for its intended and lawful purpose",
            "follow all instructions and safety requirements",
            "ensure that the person using the equipment has the required experience, licence or qualification",
            "stop using equipment if it appears unsafe or defective",
            "protect equipment against theft, loss and avoidable damage",
            "not modify, sell, sublease or transfer equipment without the Provider's permission",
            "promptly notify the Provider of an accident, fault, loss or damage",
          ]}
        />
        <P>A Requester should not use equipment if they are uncertain about its safe operation.</P>
      </Section>

      <Section n="11" title="Equipment quality and liability">
        <P>
          Providers are responsible for ensuring that their equipment is accurately described, reasonably safe and
          suitable for the purpose communicated to them. Requesters are responsible for checking the equipment at
          collection and promptly reporting visible damage, missing parts or safety concerns.
        </P>
        <P>
          CRN&nbsp;SA does not independently inspect every item and does not guarantee that equipment will meet
          every Requester&rsquo;s particular needs. To the extent permitted by law, CRN&nbsp;SA is not responsible
          for loss, injury or damage arising directly from:
        </P>
        <Ul
          items={[
            "inaccurate information supplied by a Provider or Requester",
            "unsafe, defective or unsuitable equipment supplied by a Provider",
            "misuse or unauthorised use of equipment",
            "collection, transport, storage or return arrangements between users",
            "conduct occurring outside the Platform",
          ]}
        />
        <P>
          Nothing in these Terms excludes, restricts or modifies any consumer guarantee, right or remedy that
          cannot legally be excluded under Australian law.
        </P>
      </Section>

      <Section n="12" title="Loss, damage and late return">
        <P>
          The Requester must notify the Provider as soon as possible if equipment is lost, stolen, damaged or
          cannot be returned on time. The Requester may be responsible for reasonable repair or replacement costs
          where loss or damage results from:
        </P>
        <Ul
          items={[
            "negligence",
            "misuse",
            "failure to follow instructions",
            "unauthorised modification",
            "failure to take reasonable care",
            "use by an unauthorised person",
          ]}
        />
        <P>
          The Requester is not responsible for pre-existing damage, ordinary wear and tear or a defect that was
          not caused by the Requester. Any claim should be supported by reasonable evidence, including condition
          photographs, repair quotations or replacement costs.
        </P>
        <P>
          Where a damage claim is disputed, both parties should retain booking records, messages, handover
          photographs and relevant quotations. CRN&nbsp;SA may review available Platform records to assist
          communication but does not guarantee a particular outcome.
        </P>
      </Section>

      <Section n="13" title="Cancellations">
        <P>
          The Provider must clearly disclose the applicable cancellation deadline, any cancellation charge,
          treatment of the deposit, no-show consequences and refund arrangements before a booking is confirmed.
        </P>
        <P>
          A Provider may cancel a booking if equipment becomes unavailable, unsafe or damaged. Where a Provider
          cancels a paid booking, the Requester must receive an appropriate refund unless the cancellation
          resulted from the Requester&rsquo;s breach.
        </P>
        <P>
          A Requester may cancel through the Platform where cancellation is permitted. Any fee or retained amount
          must be consistent with the conditions disclosed before confirmation, reasonably connected to the
          cancellation and permitted by law. Payment-processing fees will only be retained where this was
          disclosed and is legally permitted.
        </P>
      </Section>

      <Section n="14" title="Reviews and feedback">
        <P>
          After equipment has been returned or a transaction has been completed, the Platform may allow the
          parties to provide a rating or review. Reviews must:
        </P>
        <Ul
          items={[
            "relate to a genuine transaction",
            "be honest and based on personal experience",
            "avoid abusive, discriminatory or threatening language",
            "not include private or confidential information",
            "not contain knowingly false or misleading statements",
          ]}
        />
        <P>
          CRN&nbsp;SA may remove reviews that breach these requirements. General website feedback is separate from
          transaction reviews.
        </P>
      </Section>

      <Section n="15" title="Notifications">
        <P>The Platform may send notifications about:</P>
        <Ul
          items={[
            "account approval",
            "booking requests",
            "Provider decisions",
            "payment status",
            "collection and return reminders",
            "cancellations",
            "equipment return status",
            "reviews or disputes",
          ]}
        />
        <P>
          Users remain responsible for checking their account and ensuring their contact information is current.
          CRN&nbsp;SA cannot guarantee uninterrupted delivery of email or Platform notifications.
        </P>
      </Section>

      <Section n="16" title="User content and equipment images">
        <P>
          Users retain ownership of the content they upload. By uploading content, users grant CRN&nbsp;SA a
          non-exclusive, royalty-free licence to store, display, reproduce and use that content for operating and
          promoting the Platform. Users must only upload content they own or are authorised to use.
        </P>
        <P>CRN&nbsp;SA may:</P>
        <Ul
          items={[
            "apply a watermark to uploaded equipment images",
            "resize or optimise images",
            "limit the number, type and size of uploaded files",
            "remove inappropriate, misleading or infringing content",
          ]}
        />
      </Section>

      <Section n="17" title="Privacy">
        <P>
          CRN&nbsp;SA may collect personal information required to operate the Platform, manage accounts, process
          requests and communicate with users. Personal information will be handled according to our{" "}
          <Link href="/privacy" className="font-semibold text-pine underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          and applicable Australian privacy requirements.
        </P>
        <P>
          The separate Privacy Policy explains the types of information collected, the purposes of collection,
          disclosures to service providers, storage and retention, security, access and correction rights,
          complaints, cookies and third-party services used by the Platform. Users must not misuse another
          person&rsquo;s personal or booking information.
        </P>
      </Section>

      <Section n="18" title="Prohibited conduct">
        <P>Users must not:</P>
        <Ul
          items={[
            "use the Platform for unlawful or fraudulent purposes",
            "provide false or misleading information",
            "interfere with the Platform's security or operation",
            "attempt to access another user's account",
            "avoid Platform fees through deceptive conduct",
            "harass or discriminate against another user",
            "upload malicious software",
            "manipulate ratings or reviews",
            "use information obtained through the Platform for unsolicited marketing",
          ]}
        />
      </Section>

      <Section n="19" title="Suspension and termination">
        <P>CRN&nbsp;SA may warn, suspend or terminate an account where a user:</P>
        <Ul
          items={[
            "breaches these Terms",
            "creates a safety or security risk",
            "engages in fraudulent or unlawful conduct",
            "repeatedly fails to meet booking obligations",
            "misuses another person's information",
          ]}
        />
        <P>
          Where appropriate, the user will be given an opportunity to respond. Immediate action may be taken where
          necessary to protect users, equipment or the Platform.
        </P>
      </Section>

      <Section n="20" title="Platform availability">
        <P>
          We aim to keep the Platform available and accurate, but we do not guarantee that it will always operate
          without interruptions, delays or technical errors. We may modify, suspend or discontinue a feature for
          maintenance, security or operational reasons. Users should retain copies of important booking
          confirmations and communications.
        </P>
      </Section>

      <Section n="21" title="Complaints and disputes">
        <P>
          Users should first attempt to resolve equipment, payment, damage, collection or return issues directly
          with the other party. If the matter cannot be resolved, a user may contact CRN&nbsp;SA through the
          Platform or at:
        </P>
        <P className="font-tag text-xs uppercase tracking-wide text-ink/60">
          Email: [insert support email] &middot; Phone: [insert phone number] &middot; Address: [insert CRN&nbsp;SA
          address]
        </P>
        <P>
          CRN&nbsp;SA may review Platform records and assist communication between the parties, but it is not
          required to decide private disputes unless required by law. Nothing in this section prevents a person
          from contacting a consumer protection agency, law-enforcement body or other appropriate authority.
        </P>
      </Section>

      <Section n="22" title="Australian Consumer Law">
        <P>
          These Terms operate subject to the Competition and Consumer Act 2010, including the Australian Consumer
          Law, and any other rights that cannot legally be excluded. If a provision of these Terms conflicts with
          a non-excludable legal right, that legal right will apply.
        </P>
      </Section>

      <Section n="23" title="Changes to these Terms">
        <P>
          CRN&nbsp;SA may update these Terms to reflect changes to the Platform, its services or applicable
          requirements. The updated version and effective date will be published on the Platform. Where a
          material change affects existing users, reasonable notice will be provided.
        </P>
        <P>
          The Terms accepted when a booking is confirmed will continue to govern that booking. Material changes
          will not apply retrospectively to an existing confirmed booking unless required by law or agreed by the
          affected parties. Continued use of the Platform after updated Terms take effect constitutes acceptance
          for future use and transactions.
        </P>
      </Section>

      <Section n="24" title="Governing law">
        <P>
          These Terms are governed by the laws of South Australia and the applicable laws of the Commonwealth of
          Australia. The parties submit to the jurisdiction of the courts of South Australia and any courts
          entitled to hear appeals from them.
        </P>
      </Section>

      <Section n="25" title="Contact us">
        <P>Questions about these Terms may be sent to:</P>
        <P className="font-tag text-xs uppercase tracking-wide text-ink/60">
          Community Resource Network SA &middot; Email: [insert support email] &middot; Phone: [insert phone
          number] &middot; Address: [insert postal address]
        </P>
      </Section>

      <div className="mt-10 rounded-lg border border-dashed border-canvas-line p-4 font-body text-xs text-ink/50">
        Reference sources: Australian Competition and Consumer Commission,{" "}
        <em>Consumer rights and guarantees</em>; Office of the Australian Information Commissioner,{" "}
        <em>Australian Privacy Principles</em>.
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

function Ol({ items }: { items: string[] }) {
  return (
    <ol className="mt-2 list-decimal space-y-1 pl-5 font-body leading-relaxed text-ink/80">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}
