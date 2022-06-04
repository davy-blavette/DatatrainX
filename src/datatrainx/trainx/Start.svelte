<script>

    import {fly } from 'svelte/transition';
    import {layoutTrainxStore, titleTestStore, userIdtStore} from "../../stores";
    import {userToken} from "../../service-factory/data";
    import Faceapi from "../utils/Faceapi.svelte";
    import ChartStream from "../utils/ChartStream.svelte";
    import Token from "./Token.svelte";
    import Kolb from "./Kolb.svelte";

    //Layout DataTrainX profile
    export const views = {
        token: Token,
        kolb: Kolb
    };

    let layoutValue = "token";
    let viewportComponent = layoutValue;
    let titleTest;
    let userId;

    userIdtStore.subscribe(value => {
        userId = value;
    });

    titleTestStore.subscribe(value => {
        titleTest = value;
    });

    layoutTrainxStore.setLayout(layoutValue);


    layoutTrainxStore.subscribe(value => {
        layoutValue = value;
    });

    function updateViewportComponent() {
        viewportComponent = views[layoutValue];
    }


    updateViewportComponent();


</script>

<style>
    .trainx{
        border: 1px solid #3b065e;
        border-top-right-radius: 6px 6px;
        border-top-left-radius: 6px 6px;
        background: aliceblue;
        color: gray;
        overflow: auto;
    }
    .token{
        font-size: .75rem;
        display: block;
    }

    .token i{
        color: #ff0000;
        animation: blink-animation 1s steps(2, start) infinite;
    }
    .faceapi{
        width: 100%;
        overflow: hidden;
        position: relative;
        padding: 0;
    }


</style>


<div class="columns trainx center is-vcentered is-multiline">
    <div class="column is-full">
        <div class="columns notification is-info">
        {#if viewportComponent == views[layoutValue]}
            <div class="column is-two-thirds" on:outroend={updateViewportComponent} transition:fly="{{ y: 200, duration: 1000 }}">
                <slot>
                    <svelte:component this={viewportComponent}/>
                </slot>
            </div>
        {/if}
            <div class="column is-one-third">
                <div class="faceapi">
                    <Faceapi/>
                </div>
                <div class="token tile is-parent has-text-right">
                    {userId} - {titleTest}
                </div>
            </div>
        </div>
    </div>
    <div class="column">
        <ChartStream/>
    </div>
</div>
