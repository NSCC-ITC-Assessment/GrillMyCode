import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

const FeatureList = [
  {
    title: 'Set up once',
    Svg: require('@site/static/img/grillmycode-setup.svg').default,
    description: (
      <>
        Save one OpenRouter key in your classroom&apos;s organization and every student repository
        can use it. After that, each assignment needs just one workflow file.
      </>
    ),
  },
  {
    title: 'Built for Classroom 50',
    Svg: require('@site/static/img/grillmycode-classroom.svg').default,
    description: (
      <>
        Automatically excludes the template&apos;s starter code and Classroom 50&apos;s setup files,
        so only the student&apos;s own work is assessed.
      </>
    ),
  },
  {
    title: 'Questions, and answers',
    Svg: require('@site/static/img/grillmycode-delivery.svg').default,
    description: (
      <>
        Each student gets questions about their own code, as a GitHub issue and a PDF. You can
        also keep a private answer key, with a quiz ready to import into your LMS.
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
