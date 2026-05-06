export default function TemplatesPage() {
  return (
    <main className="mx-auto max-w-3xl p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Templates</h1>
      <p className="text-sm text-neutral-600">
        Upload a PDF (with form fields) or DOCX (with <code>{"{{placeholder}}"}</code> tags).
      </p>
      <form
        className="space-y-3 rounded-2xl border p-4"
        action="/api/templates"
        method="post"
        encType="multipart/form-data"
      >
        <input name="name" required placeholder="Template name" className="w-full rounded-md border px-3 py-2" />
        <input name="file" type="file" required accept=".pdf,.docx" className="w-full" />
        <button className="rounded-md bg-black px-3 py-2 text-white">Upload</button>
      </form>
    </main>
  );
}
