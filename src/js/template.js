const template = {};

/** @type {Map<string, HTMLTemplateElement>} */
const allTemplates = new Map();
Array.from(document.querySelectorAll('template[id]')).forEach(template => {
  allTemplates.set(template.id, template);
  template.remove();
});

export default template;

/**
 * @param {string} id
 * @returns {[HTMLElement, Map<string, HTMLElement>]}
 */
template.create = function (id) {
  const template = allTemplates.get(id);
  /** @type {DocumentFragment} */
  const content = template.content.cloneNode(true);
  const result = content.firstElementChild;
  const reference = new Map();
  Array.from(result.querySelectorAll('[data-ref]')).forEach(ref => {
    reference.set(ref.dataset.ref, ref);
    ref.removeAttribute('data-ref');
  });
  return [result, reference];
};

template.icon = function (type, title = null) {
  const icon = document.createElement('span');
  icon.classList.add('icon', 'icon-' + type);
  if (title) {
    icon.setAttribute('title', title);
    icon.setAttribute('aria-label', title);
  } else {
    icon.setAttribute('aria-hidden', 'true');
  }
  return icon;
};

