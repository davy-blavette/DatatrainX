<script>
    import { onMount } from "svelte";
    import {baseUrl} from "../data";
    import JSONTree from 'svelte-json-tree';

    let jsonTrainers;

    onMount(async () => {
        let res = await fetch(baseUrl);
        const trainer = res.json();
        trainer.then(function(result) {
            console.log(result);
            //jsonTrainers = result;
            jsonTrainers = [result, ...jsonTrainers];
        });
    });
</script>
<div class="container is-widescreen">
    <div class="notification is-light">
        {#if jsonTrainers.length === 0}
            <p>Loading</p>
        {:else}
            {#each jsonTrainers as jsonTrainer}

                <JSONTree value={jsonTrainer} />
            {/each}
        {/if}
    </div>
</div>
