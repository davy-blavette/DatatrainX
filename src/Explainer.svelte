<script>
    import Overview from './overview/Overview.svelte';
    import {cnnStore} from './stores.js';
    import Start from "./overview/Start.svelte";

    // Enum to control the displaying view
    const View = {
        OVERVIEW: 'overview',
        LAYERVIEW: 'layerview',
        DETAILVIEW: 'detailview'
    };

    let mainView = View.OVERVIEW;

    /* Example to read loaded cnn in other components:
  $: if ( $cnnStore.length != 0) {
    console.log($cnnStore);
  }
  */

</script>

<style>
#explainer {
  width: 100%;
  padding: 0;
  margin: auto;
    position: absolute;
    transition: left 2s;
    left: 0px;
}
</style>
<main>
    <div id='start'>
        <Start />
    </div>
    <div id='explainer'>
        <Overview />
    </div>
</main>