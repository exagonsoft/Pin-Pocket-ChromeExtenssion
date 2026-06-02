export function PageHeader({
  eyebrow,
  title,
  subtitle,
  icon = "/icons/branding_logo.png",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  icon?: string;
}) {
  return (
    <header className="hero fade-up">
      <div className="hero__top">
        <img className="hero__icon" src={icon} alt="" aria-hidden="true" />
        <div className="hero__copy">
          <div className="hero__eyebrow">{eyebrow}</div>
          <h2 className="hero__title">{title}</h2>
        </div>
      </div>
      {subtitle ? <p className="hero__subtitle">{subtitle}</p> : null}
    </header>
  );
}
