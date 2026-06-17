type PageHeaderProps = {
  title: string;
  description: string;
  eyebrow?: string;
};

export function PageHeader({ title, description, eyebrow }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      {eyebrow ? (
        <p className="text-sm font-medium uppercase text-primary">{eyebrow}</p>
      ) : null}
      <h1 className="text-2xl font-semibold tracking-normal md:text-3xl">{title}</h1>
      <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
        {description}
      </p>
    </div>
  );
}
