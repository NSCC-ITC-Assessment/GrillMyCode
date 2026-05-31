import ExecutionEnvironment from '@docusaurus/ExecutionEnvironment';

if (ExecutionEnvironment.canUseDOM) {
  const isWizardPage = () =>
    window.location.pathname.includes('/workflow-wizard');

  const removeIfPresent = () => {
    if (!isWizardPage()) return;
    document.getElementById('copy-page-button-container')?.remove();
  };

  // React to the container being injected (or re-injected after navigation).
  const observer = new MutationObserver(removeIfPresent);
  observer.observe(document.body, { childList: true, subtree: true });

  // Also handle Docusaurus SPA route transitions.
  document.addEventListener('docusaurus-route-update', removeIfPresent);
}
