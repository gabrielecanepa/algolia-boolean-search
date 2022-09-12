import { highlight } from 'instantsearch.js/es/helpers'
import { titleize } from '@/utils/string'

export default hit => {
  const { brand, categories, color, imageUrl, name } = hit

  return `
    <img class="ais-Hits-item__image" src="${imageUrl}" alt="${name}" />
    <div class="ais-Hits-item__content">
      <h3 class="ais-Hits-item__title">${highlight({
        attribute: 'name',
        hit,
      })}</h3>
      ${categories.length > 0 &&
        `
          <p class="ais-Hits-item__category">
            ${categories.map((_, i) => highlight({ attribute: `categories.${i}`, hit })).join(' / ')}
          </p>
        `}
      ${brand &&
        `<a class="ais-Hits-item__brand">${highlight({
          attribute: 'brand',
          hit,
        })}</a>`}
      ${color &&
        `<div class="ais-Hits-item__color" style="background-color: ${hit.color.toLowerCase()}" title="${titleize(
          color
        )}"></div>`}
    </div>
  `
}
