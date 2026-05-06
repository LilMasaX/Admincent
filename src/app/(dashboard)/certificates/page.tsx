export default function CertificatesPage() {
  return (
    <main className="mx-auto max-w-3xl p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Certificates</h1>
      <p className="text-sm text-neutral-600">
        POST <code>/api/certificates/generate</code> with{" "}
        <code>{"{ templateId, values }"}</code> to create a filled certificate.
      </p>
    </main>
  );
}
