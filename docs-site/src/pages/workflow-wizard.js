import React from 'react';
import Layout from '@theme/Layout';
import WorkflowWizard from '@site/src/components/WorkflowWizard';

export default function WorkflowWizardPage() {
  return (
    <Layout
      title="Workflow Wizard"
      description="Generate a GitHub Actions workflow YAML for GrillMyCode by answering a few questions about your setup."
    >
      <main>
        <WorkflowWizard />
      </main>
    </Layout>
  );
}
