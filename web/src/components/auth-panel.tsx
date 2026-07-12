import { AudioLines } from "lucide-react";

export function AuthPanel({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#fafafa] p-5">
      <section className="w-full max-w-[380px] rounded-lg border bg-white p-6 shadow-[0_12px_40px_rgba(41,41,41,0.05)]">
        <div className="mb-7 flex items-center gap-2 text-[14px] font-semibold">
          <span className="grid size-8 place-items-center rounded-md bg-[#292929] text-white">
            <AudioLines className="size-4" aria-hidden="true" />
          </span>
          Saranote
        </div>
        <p className="mb-2 text-[12px] font-medium uppercase text-subtle">{eyebrow}</p>
        <h1 className="text-[24px] font-semibold leading-8 text-strong">{title}</h1>
        <p className="mt-2 text-[13px] leading-5 text-default">{description}</p>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
