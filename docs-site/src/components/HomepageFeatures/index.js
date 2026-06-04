import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Zero Setup',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Uses GitHub Models by default — no API keys or secrets needed.
        Just add the workflow file and the built-in <code>GITHUB_TOKEN</code> handles everything.
      </>
    ),
  },
  {
    title: 'Built for GitHub Classroom',
    Svg: require('@site/static/img/undraw_docusaurus_tree.svg').default,
    description: (
      <>
        Automatically excludes template starter code and bot commits,
        so only the student&apos;s own work is assessed — no extra configuration required.
      </>
    ),
  },
  {
    title: 'Flexible Delivery',
    Svg: require('@site/static/img/undraw_docusaurus_react.svg').default,
    description: (
      <>
        Assessment questions are posted as a GitHub Issue and a downloadable PDF.
        Supports GitHub Models and OpenRouter for AI-powered question generation.
      </>
    ),
  },
];

function Feature({Svg, title, description}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
