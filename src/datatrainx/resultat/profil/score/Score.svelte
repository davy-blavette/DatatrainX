<script>
    import Modere from "./Modere.svelte";
    import Tresfort from "./Tresfort.svelte";
    import Fort from "./Fort.svelte";
    import Bas from "./Bas.svelte";
    import Tresbas from "./Tresbas.svelte";
    export let score;
</script>

{#if score == 5}
    <Tresfort />
{:else if score == 4}
    <Fort />
{:else if score == 3}
    <Modere />
{:else if score == 2}
    <Bas />
{:else}
    <Tresbas />
{/if}