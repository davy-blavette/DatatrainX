<script>

    import { fade, fly } from 'svelte/transition'

    import Presentation from "./Presentation.svelte";
    import Cnn from './Cnn.svelte';
    import Article from "./article/Article.svelte";
    import Layout from "./trainx/Layout.svelte";
    import TrainX1 from "./trainx/TrainX1.svelte";
    import TrainX2 from "./trainx/TrainX2.svelte";

    import {chartStore, layoutStore, videoStore} from "../stores";
    import {Chart} from "chart.js";

    //Layout DataTrainX
    export const views = {
        presentation: Presentation,
        cnn: Cnn,
        trainx1: TrainX1,
        trainx2: TrainX2
    };

    let layoutValue;
    let playVideo;
    let playChart;
    let viewportComponent = null;


    layoutStore.subscribe(value => {
        layoutValue = value;
    });
    videoStore.subscribe(value => {
        playVideo = value;
    });
    chartStore.subscribe(value => {
        playChart = value;
    });

    function updateViewportComponent() {
        videoStore.set(false);
        if (typeof playChart.destroy === "function") {
            playChart.destroy();
        }
        viewportComponent = views[layoutValue];
    }
    updateViewportComponent();
</script>

<style>
#main{
    padding: 1em;
    background-color: #3b065e;
    margin-top: 50px;
}
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