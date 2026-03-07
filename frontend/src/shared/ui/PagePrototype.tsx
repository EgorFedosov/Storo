type PagePrototypeProps = {
  title: string
  description: string
  checklist: readonly string[]
}

export function PagePrototype({ title, description, checklist }: PagePrototypeProps) {
  return (
    <section className="page-prototype">
      <h2>{title}</h2>
      <p>{description}</p>

      <ul>
        {checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
