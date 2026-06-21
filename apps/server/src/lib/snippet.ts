/**
 * The SDK install snippet shown in the empty state and the ⌘K "Copy SDK snippet"
 * action. Single source of truth so the two copies never drift.
 */
export const SDK_SNIPPET = `<script src="/sdk/tinyreplay.umd.js"></script>
<script>
  TinyReplay.init({
    endpoint: location.origin,
    projectId: 'my-project',
  })
</script>`;
