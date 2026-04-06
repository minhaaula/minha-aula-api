import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Minha Aula',
  tagline: 'Documentação da API',
  favicon: 'img/favicon.ico',

  future: {
    v4: true
  },

  url: 'https://localhost',
  baseUrl: '/portal/',

  organizationName: 'minha-aula',
  projectName: 'minha-escola-api',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: undefined
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css'
        }
      } satisfies Preset.Options
    ]
  ],

  themeConfig: {
    image: 'img/docusaurus-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true
    },
    navbar: {
      title: 'Minha Aula API',
      logo: {
        alt: 'Logo',
        src: 'img/logo.svg'
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentação'
        },
        {
          href: 'pathname:///docs',
          label: 'Swagger (playground)',
          position: 'right'
        }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentação',
          items: [
            {
              label: 'Introdução',
              to: '/intro'
            },
            {
              label: 'Módulo Students',
              to: '/modules/students'
            }
          ]
        },
        {
          title: 'API',
          items: [
            {
              label: 'Swagger UI',
              href: 'pathname:///docs'
            },
            {
              label: 'OpenAPI JSON',
              href: 'pathname:///docs/openapi.json'
            }
          ]
        }
      ],
      copyright: `© ${new Date().getFullYear()} Minha Aula.`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula
    }
  } satisfies Preset.ThemeConfig
};

export default config;
