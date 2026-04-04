export const lxResolverFixture = `
const { EVENT_NAMES, on, send } = globalThis.lx

on(EVENT_NAMES.request, ({ action }) => {
  if (action === 'musicUrl') {
    return Promise.resolve('https://demo/song.mp3')
  }

  return Promise.reject(new Error('action not support'))
})

send(EVENT_NAMES.inited, {
  sources: {
    kw: {
      name: 'kw',
      type: 'music',
      actions: ['musicUrl'],
      qualitys: ['128k'],
    },
  },
})
`;

export const lxNetworkOnInitFixture = `
fetch('https://demo.test/source.js')
`;
