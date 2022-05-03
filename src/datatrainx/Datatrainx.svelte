<script>

    import { fade, fly } from 'svelte/transition'

    import Presentation from "./Presentation.svelte";
    import Cnn from './Cnn.svelte';
    import Article from "./article/Article.svelte";
    import Layout from "./trainx/Layout.svelte";
    import TrainX1 from "./trainx/TrainX1.svelte";
    import TrainX2 from "./trainx/TrainX2.svelte";

    import {layoutStore} from "../stores";

    //Layout DataTrainX
    export const views = {
        presentation: Presentation,
        cnn: Cnn,
        trainx1: TrainX1,
        trainx2: TrainX2
    };

    let layoutValue;
    let viewportComponent = null;


    layoutStore.subscribe(value => {
        layoutValue = value;
    });


    function updateViewportComponent() {
        viewportComponent = views[layoutValue]
    }
    updateViewportComponent();
</script>

<style>

</style>
<main>
    {#if viewportComponent == views[layoutValue]}
    <section id='main' class="" on:outroend={updateViewportComponent} transition:fly="{{ y: 200, duration: 1000 }}">
        <Layout>
            <svelte:component this={viewportComponent}/>
        </Layout>
    </section>
    {/if}

    <section id='article' class="section">
        <Article/>
    </section>
</main>