import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/intro">
            Documentação por módulo
          </Link>
          <a className="button button--outline button--secondary button--lg" href="pathname:///docs">
            Swagger (playground)
          </a>
        </div>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description="Documentação funcional e referência da API Minha Aula.">
      <HomepageHeader />
      <main className="container margin-vert--lg">
        <div className="row">
          <div className="col col--6 margin-bottom--md">
            <Heading as="h2">Módulos</Heading>
            <ul>
              <li>
                <Link to="/modules/auth">Auth</Link>
              </li>
              <li>
                <Link to="/modules/admin">Admin</Link>
              </li>
              <li>
                <Link to="/modules/payments">Payments</Link>
              </li>
              <li>
                <Link to="/modules/schools">Schools</Link>
              </li>
              <li>
                <Link to="/modules/students">Students</Link>
              </li>
            </ul>
          </div>
          <div className="col col--6 margin-bottom--md">
            <Heading as="h2">Referência API</Heading>
            <p>
              Teste endpoints na mesma origem: <a href="pathname:///docs">Swagger UI</a> ou{' '}
              <a href="pathname:///docs/openapi.json">OpenAPI JSON</a>.
            </p>
          </div>
        </div>
      </main>
    </Layout>
  );
}
