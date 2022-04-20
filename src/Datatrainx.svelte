<script>
    import Cnn from './overview/Cnn.svelte';
    import {cnnStore} from './stores.js';
    import Start from "./overview/Presentation.svelte";
    import Article from "./article/Article.svelte";

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
    #cnn {
        width: 100%;
        padding: 0;
        margin: auto;
        transition: left 2s;
        left: 0px;
    }
</style>
<main>
    <section id='start'>
        <Start/>
    </section>
    <section id='cnn'>
        <Cnn/>
    </section>
    <section id='description'>
        <Article/>
    </section>
</main>