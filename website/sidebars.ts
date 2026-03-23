import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    {
      type: 'category',
      label: 'Módulos da API (visão geral)',
      items: [
        'modules/auth',
        'modules/admin',
        'modules/payments',
        'modules/schools',
        'modules/students'
      ]
    },
    {
      type: 'category',
      label: 'Rotas — funcionalidade por endpoint',
      items: [
        'modules/routes/auth',
        'modules/routes/admin',
        'modules/routes/payments',
        'modules/routes/schools',
        'modules/routes/students',
        'modules/routes/dependents',
        'modules/routes/enrollment-requests',
        'modules/routes/publico-e-cadastro',
        'modules/routes/integracoes'
      ]
    },
    {
      type: 'category',
      label: 'Referência',
      items: ['reference/openapi']
    }
  ]
};

export default sidebars;
