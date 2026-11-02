// Renders a <script type="application/ld+json"> tag from a plain object.
// Every caller passes locally-built data (no user input reaches this), so
// the JSON.stringify output is safe to inject directly.
export default function JsonLd({ data }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
