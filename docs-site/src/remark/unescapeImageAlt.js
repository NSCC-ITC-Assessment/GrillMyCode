// Docusaurus's built-in transformImage remark plugin HTML-escapes an image's
// alt and title text before storing it as a JSX attribute, and React escapes it
// again when rendering. So `![An organization's list](/img/x.png)` reaches the
// page with the alt text "An organization&#39;s list", which screen readers read
// out literally. This plugin reverses the first escape.
//
// It must run after transformImage. Plugins passed as `remarkPlugins` run after
// Docusaurus's defaults, so register it there, not in beforeDefaultRemarkPlugins.

// The exact inverse of the escape-html package that transformImage uses.
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" };
const ENTITY_PATTERN = /&(amp|lt|gt|quot|#39);/g;

const unescapeHtml = (text) => text.replace(ENTITY_PATTERN, (_, name) => ENTITIES[name]);

// transformImage turns a local Markdown image into an <img> whose src is a
// require() expression. Hand-written <img> tags have a plain string src, so
// their attributes are left alone.
const isTransformedImage = (node) =>
  node.type === 'mdxJsxTextElement' &&
  node.name === 'img' &&
  node.attributes.some(
    (attr) => attr.name === 'src' && attr.value?.type === 'mdxJsxAttributeValueExpression',
  );

const visit = (node) => {
  if (isTransformedImage(node)) {
    for (const attr of node.attributes) {
      if ((attr.name === 'alt' || attr.name === 'title') && typeof attr.value === 'string') {
        attr.value = unescapeHtml(attr.value);
      }
    }
  }
  node.children?.forEach(visit);
};

export default function unescapeImageAlt() {
  return (tree) => visit(tree);
}
