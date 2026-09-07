import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'One-Time Setup',
    Svg: require('@site/static/img/undraw_docusaurus_mountain.svg').default,
    description: (
      <>
        Add one <code>OPENROUTER_API_KEY</code> secret at the organisation level and every
        student repository inherits it. After that, each assignment just needs the workflow file.
      </>
    ),
  },
  {
    title: 'Built for Classroom 50',
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
        Questions are generated through OpenRouter, so you can pick any model it offers.
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
