<script>

    import { time, elapsed} from '../utils/datatrainx.js';
    import {leftStartStore} from "../stores";
    let innerWidth;
    let innerHeight;
    let clientHeight;
    let top = 50;

    let leftStartValue;

    leftStartStore.subscribe(value => {
        leftStartValue = value;
    });

    const formatter = new Intl.DateTimeFormat('en', {
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit'
    });


</script>
<style>
    .start {
        width: 100%;
        padding: 0;
        margin: auto;
        position: absolute;
        transition: left 2s;
        left: 0px;
        background-color: #3b065e;
        z-index: 9;
    }
</style>
<svelte:window bind:innerHeight bind:innerWidth   />

<section id="home" class="start jumbotron text-center"  style="height: {innerHeight - top}px; left:{leftStartValue}px">


    <div class="container">
        <div class="columns">
            <div class="column is-white">
                <h1>The time is {formatter.format($time)}</h1>
                <p>
                    This page has been open for
                    {$elapsed} {$elapsed === 1 ? 'second' : 'seconds'}
                </p>
                <p class="lead text-muted">Something short and leading about the collection below—its contents, the creator, etc. Make it short and sweet, but not too short so folks don’t simply skip over it entirely.</p>

                <button class="button is-success" id="strat-button" on:click={leftStartStore.set(-innerWidth)}>
                <span class="icon">
                  <i class="fa-solid fa-address-card"></i>
                </span>
                    <span>Faire le test</span>
                </button>

            </div>

            <div class="column is-white">
                <button class="button is-info" id="explain-button" on:click={leftStartStore.set(-innerWidth)}>
                <span class="icon">
                  <i class="fas fa-eye"></i>
                </span>
                    <spa>Comment ça marche ?</spa>
                </button>
            </div>
        </div>

    </div>
</section>



