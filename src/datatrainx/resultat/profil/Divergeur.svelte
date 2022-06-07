<script>
    import Reflector from "./Reflector.svelte";
    import Activist from "./Activist.svelte";
    export let reflector;
    export let activist;
</script>
<div class="">
    <p>Les apprenants qui ont une préférence pour ce style d’apprentissage vont adopter une position en retrait pour observer et interpréter l’expérience vécue. Ils apprennent davantage lorsqu’ils se trouvent dans les phases de l’expérience concrète et de l’observation réfléchie. Le divergeur aimera confronter la situation à un grand nombre d’opinions et d’idées différentes, ce qui facilitera l’identification de solutions uniques et originales. Il possède un bon sens de l’observation et beaucoup d’imagination, ce qui lui permet de relever des éléments que les autres ne remarqueront pas. Ayant un certain besoin d’affiliation, il s’intéressera aux personnes qui l’entourent et prendra en considération leurs émotions et sentiments pour déterminer la solution privilégiée.</p>
    <p class="subtitle">Implications pour la formation en organisation :</p>
    <p>pour répondre à ce style d’apprentissage, une formation doit inclure des périodes de discussion et d’échange entre le formateur et les apprenants. À ce titre, une formation peut recourir à des anecdotes, des métaphores et des analogies afin d’illustrer certaines notions aux apprenants et leur permettre d’échanger des idées.</p>
    <hr>
    <Reflector
            score={reflector}
    />
    <Activist
            score={activist}
    />
</div>