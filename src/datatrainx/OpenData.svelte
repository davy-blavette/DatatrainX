<script>
    import { onMount } from "svelte";
    import {baseUrl} from "../data";
    import JSONTree from 'svelte-json-tree';

    let jsonTrainers = [];

    onMount(async () => {
        let res = await fetch(baseUrl);
        jsonTrainers = await res.json();
        console.log(jsonTrainers);
    });


</script>

<section class="container is-widescreen">
{#if jsonTrainers.length === 0}
    <p>Loading</p>
{:else}
    {#each jsonTrainers as jsonTrainer}
        <div class="notification is-light">
            <JSONTree value={jsonTrainer} />
        </div>
    {/each}
{/if}
</section>
