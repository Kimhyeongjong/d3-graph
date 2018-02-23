/**
 * *****************************
 * 2018.02.07
 * 김형종 생성
 * Bitnine D3 Graph 모듈
 *
 * 사용법은 아래와 같음
 *
   var nodes = [];
   var edges = [];

   var node = {

       "id": "노드아이디"
       ,"name": "노드명칭"
       ,"size": "사이즈"
       ,"prop": "프로퍼티"
       ,"nodeColor": "노드색상"
       ,"textColor": "노드명색상"

   };

   // 엣지 데이터
   var edge = {

       "id": "엣지아이디"
       ,"type": "엣지명칭"
       ,"source": "소스 노드 아이디"
       ,"target": "타겟 노드 아이디"
       ,"prop": "프로퍼티"
       ,"value": "엣지굵기"
       ,"linkColor": "엣지 색상"
       ,"textColor": "엣지명칭 색상"

   };

   nodes.push(node);
   edges.push(edge);

   var graph = graphModule('태그아이디', nodes, edges);
   graph.draw();

 *
 *
 * *****************************
 */

console.log('Bitnine D3 Graph Script load.');

/** 그래프 모듈 클로저 */
var graphModule = function(svgTag, nodesData, linksData){

    //그래프 스케일 조정 변수
    var linkScale = d3.scaleLinear().domain([0, 1000]).range([1, 10]); //링크 스케일 변수
    var nodeScale = d3.scaleLinear().domain([0, 10000]).range([50, 150]); //노드 스케일 변수

    //모듈 호출시 svg태그 초기화
    $('#'+svgTag).empty();

    //파라미터로 받아온 svg태그의 width와 height를 가져옴
    var svg = d3.select(`#${svgTag}`);
    var width = svg.node().getBoundingClientRect().width;
    var height = svg.node().getBoundingClientRect().height;
    var center_force = d3.forceCenter(width / 2, height / 2); //레이아웃 중앙에 그래프를 그림
    var simulation; //시뮬레이션 변수
    var zoomLayer; //줌 레이어
    var g; // 줌레이어를 포함하고있는 g 태그
    var link; //링크 객체
    var node; //노드 객체
    var text; // 노드 라벨 객체
    var nodes = []; //노드 데이터
    var links = []; //링크 데이터
    var pathInvis; // 아치형 링크를 만들기 위해 필요한 변수
    var context = null;
    var contextMenu; //컨텍스트 메뉴
    var linkLabels;//링크 레이블
    var linkedByIndex;
    var shiftKey; //시프트키 이벤트키
    var gBrushHolder; //노드 다중선택 브러쉬 홀더
    var gBrush; //노드 다중선택 브러쉬
    var brushMode;//노드 다중선택모드
    var brushing;
    var brush;
    var clickCnt = 0; //클릭 카운트
    var nbObj = [];

/** Init >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> */

    var init = function(){

        console.log("graph Init.. ");

        /** 노드 사이즈 스케일적용 */
        $.each(nodesData, function(i,e){
           e.size = nodeScale(e.size);
        });

        /** 링크 사이즈 스케일 적용 */
        $.each(linksData, function(i,e){
            e.value = linkScale(e.value);
         });

        nodes = nodesData; //노드 데이터 넣기
        links = linksData; //링크 데이터 넣기

        /** 기본 Context 메뉴. 변경해서 사용 가능 */
        $('#context-menu').remove();
        var innerHtml = "";
        innerHtml += '<ul id="context-menu" class="menu">';
        innerHtml += '    <li class="circle" id="nodeExpand" style="text-align: center;">Expand</li>';
        innerHtml += '</ul>';

        var parentTh = $('body').append(innerHtml);

        /** Context Menu */
        contextMenu = function(that, newContext) {

            if (context) {
                if (context !== newContext) {
                    console.log('contextmenu: cannot execute for context: ' + newContext + ' while in current context: ' + context);
                    return;
                }
            }
            context = newContext;
            //console.log('contextmenu:' + context);
            d3.event.preventDefault();

            d3.select('#context-menu')
                .style('position', 'absolute')
                .style('left', event.pageX + "px")
                .style('top', event.pageY + "px")
                .style('display', 'inline-block')
                .on('mouseleave', function() { // 마우스 포인터가 context-menu를 떠나는 순간 이벤트

//                    d3.select(that).classed("selected",false);
                    d3.select('#context-menu').style('display', 'none');
                    context = null;

                });

            d3.select('#context-menu').attr('class', 'menu ' + context);


        }; // END contextMenu

    };
/** <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< */

/** 이벤트 기능 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> */

    /** 링크 화살표 태그 생성 */
    function fnAddArrowTag(){

        //링크의 개수만큼 생성함
        $.each(links, function(i,e){

            svg
                .append('defs')
                .append('marker')
                .attr("id", "arrowhead"+e.id)
                .attr("refX", 10)
                .attr("refY", 5)
                .attr("markerWidth", 10)
                .attr("markerHeight", 10)
                .attr("markerUnits", "strokeWidth")  // !! path stokewidth 만 변경하면 화살표 사이즈 자동으로 바뀜
                .attr("orient", "auto")
                .append("path")
                .attr("d", "M 0,1 V 8 L10,5 Z")
                .attr('fill', e.linkColor )
                .style('opacity', 1.0)
                .style('stroke','none');

        });

    };


    /** 드래그 시작 */
    function dragstarted(d) {

        if (!d3.event.active) simulation.alphaTarget(0.3).restart();

        if (!d.selected && !shiftKey) {
            // if this node isn't selected, then we have to unselect every other node
            node.classed("selected", function(p) { return p.selected =  p.previouslySelected = false; });
        }

        d3.select(this).classed("selected", function(p) { d.previouslySelected = d.selected; return d.selected = true; });

        node
            .filter(function(d) { return d.selected; })
            .each(function(d) { //d.fixed |= 2;
              d.fx = d.x;
              d.fy = d.y;
            });

    };

    /** 드래그중 */
    function dragged(d) {

        node.filter(function(d) { return d.selected; })
        .each(function(d) {
            d.fx += d3.event.dx;
            d.fy += d3.event.dy;
        });

    };

    /** 드래그 종료 */
    function dragended(d) {

        if (!d3.event.active) simulation.alphaTarget(0);
        d.fx = d3.event.x;
        d.fy = d3.event.y;
        node
            .filter(function(d) { return d.selected; })
            .each(function(d) { //d.fixed &= ~6;
                d.fixed &= ~6;
                d.fixed &= ~6;
            });

    };


    /** 노드클릭  */
    function nodeClick(data, index){

        if(!shiftKey){

            fnFindNeighbor(data);

            //컨택스트 메뉴 호출
            contextMenu(this, 'circle', data, index, nodes);

            //화면마다 노드 클릭 이벤트다 다를 수 있기 떄문에 따로 함수를 만들어 구현.
            var userFunc = eval(svgTag + 'NodeClick');
            if( $.isFunction(userFunc) ){
                userFunc(data, index);
            }

        }

        event.stopPropagation(); //상위 태그의 이벤트 전파를 막음

    };

    /** 링크클릭  */
    function linkClick(data, index){

        //화면마다 노드 클릭 이벤트다 다를 수 있기 떄문에 따로 함수를 만들어 구현.
        var userFunc = eval(svgTag + 'NodeClick');
        if( $.isFunction(userFunc) ){
            userFunc(data, index);
        }

        event.stopPropagation(); //상위 태그의 이벤트 전파를 막음

    };

    /** 레이어 클릭  */
    function layerClick(data, index){

//        d3.select('#context-menu').style('display', 'none');
        fnResetFindNeighbor();

        node.each(function(d) {
            d.selected = false;
            d.previouslySelected = false;
        });
        node.classed("selected", false);

    };


    /** 노드와 노드간에 연결 관계를 확인하기 위한 함수들 */
    function isConnected(a, b) {
        return isConnectedAsTarget(a, b) || isConnectedAsSource(a, b) || a.index === b.index;
    }

    function isConnectedAsSource(a, b) {
        return linkedByIndex[`${a.index},${b.index}`];
    }

    function isConnectedAsTarget(a, b) {
        return linkedByIndex[`${b.index},${a.index}`];
    }

    function isEqual(a, b) {
        return a.index === b.index;
    }


    /** 이웃한 노드, 링크 리셋 */
    function fnResetFindNeighbor(){

        d3.select('#context-menu').style('display', 'none');

        node
            .transition(500)
            .style('opacity', 1.0)

        link
            .transition(500)
            .style('stroke-opacity', 1.0 )
            .attr('marker-end', function(p) { return 'url(#arrowhead'+ p.id +')'; });

        linkLabels
            .transition(500)
            .style('opacity', 1.0 );

    };

    /** 이웃한 노드, 링크만 보여지게 하기 */
    function fnFindNeighbor(d){

        node
            .transition(500)
            .style('opacity', o => {
                const isConnectedValue = isConnected(o, d);

                if (isConnectedValue) {
                    //연결 관계가 있는 노드들은 1.0
                    return 1.0;
                }
                //연결 관계 없는 노드는 불투명하게
                return 0.2;
            });
        node
            .classed("selected", o => {

                var flag;
                if (isConnectedAsTarget(o, d) && isConnectedAsSource(o, d)) {
                    flag = false;
                } else if (isConnectedAsSource(o, d)) {
                    flag = false;
//                    if( clickCnt == 1 ) nbObj.push(o);
                } else if (isConnectedAsTarget(o, d)) {
                    flag = false;
//                    if( clickCnt == 1 ) nbObj.push(o);
                } else if (isEqual(o, d)) {
                    flag = true;
                } else {
                  //연결관계가 전혀 없는 노드는 검은색
                    flag = false;
                }
                return flag;

            });


        link
            .transition(500)
            .style('stroke-opacity', o => (o.source === d || o.target === d ? 1.0 : 0))
            .transition(500)
            .attr('marker-end', o => (o.source === d || o.target === d ? 'url(#arrowhead'+o.id+')' : 'url()'));

        linkLabels
            .transition(500)
            .style('opacity', o => (o.source === d || o.target === d ? 1.0 : 0));

    };

    //작업중.....
    /** 2 Dept 이상의 하이라이트 처리 */
//    function fnNextFindNode(){
//
//        $.each(nbObj, function(i,e){
//
//            link
//                .transition(500)
//                .style('stroke-opacity', o => {
//
//                    var opacity = 0;
//                    if( o.source === e || o.target === e ){
//
//                        opacity = 1.0;
//
//                        $('[id="' + o.source.id + '"]').css('opacity',1.0).css('fill','green');
//                        $('[id="' + o.target.id + '"]').css('opacity',1.0).css('fill','green');
//
////                        console.log(o.source);
//                        console.log(o.target);
//
//                    }
//                    return opacity;
//                })
//                .transition(500)
//                .attr('marker-end', o => (o.source === e || o.target === e ? 'url(#arrowhead'+e.id+')' : 'url()'));
//
//        });
//
//    };


    /** 아치형을 위해 노드간 이웃된 링크를 카운트 */
    function countSiblingLinks(source, target) {
        var count = 0;
        for(var i = 0; i < links.length; ++i){
            if( (links[i].source.id == source.id && links[i].target.id == target.id) || (links[i].source.id == target.id && links[i].target.id == source.id) )
                count++;
        };
        return count;
    };

    /** 노드간 이웃된 링크 개수 반환 */
    function getSiblingLinks(source, target) {
        var siblings = [];
        for(var i = 0; i < links.length; ++i){
            if( (links[i].source.id == source.id && links[i].target.id == target.id) || (links[i].source.id == target.id && links[i].target.id == source.id) )
                siblings.push(links[i].value);
        };
        return siblings;
    };

    /** 아치형 링크 계산 */
    function arcPath(leftHand, d, tp) {

        tp = tp ? tp : d.target
        var x1 = leftHand ? d.source.x : tp.x,
            y1 = leftHand ? d.source.y : tp.y,
            x2 = leftHand ? tp.x : d.source.x,
            y2 = leftHand ? tp.y : d.source.y,
            dx = x2 - x1,
            dy = y2 - y1,
            dr = Math.sqrt(dx * dx + dy * dy),
            drx = dr,
            dry = dr,
            sweep = leftHand ? 0 : 1;
            siblingCount = countSiblingLinks(d.source, d.target)
            xRotation = 0,
            largeArc = 0;

            if (siblingCount > 1) {
                var siblings = getSiblingLinks(d.source, d.target);
//                console.log(siblings);
                var arcScale = d3.scalePoint()
                                        .domain(siblings)
                                        .range([-3, siblingCount]);
                drx = drx/(1 + (1/siblingCount) * (arcScale(d.value) - 1));
                dry = dry/(1 + (1/siblingCount) * (arcScale(d.value) - 1));
            }

        return "M" + x1 + "," + y1 + "A" + drx + ", " + dry + " " + xRotation + ", " + largeArc + ", " + sweep + " " + x2 + "," + y2;
    }


    /** 노드 다중선택 드래그 시작 */
    function brushstarted() {
        // keep track of whether we're actively brushing so that we
        // don't remove the brush on keyup in the middle of a selection
        brushing = true;

        node.each(function(d) {
            d.previouslySelected = shiftKey && d.selected;
        });
    };

    /** 노드 다중선택 드래그중 */
    function brushed() {
        if (!d3.event.sourceEvent) return;
        if (!d3.event.selection) return;

        var extent = d3.event.selection;

        node.classed("selected", function(d) {
            return d.selected = d.previouslySelected ^
            (extent[0][0] <= d.x && d.x < extent[1][0]
             && extent[0][1] <= d.y && d.y < extent[1][1]);
        });
    };

    /** 노드 다중선택 드래그 종료 */
    function brushended() {
        if (!d3.event.sourceEvent) return;
        if (!d3.event.selection) return;
        if (!gBrush) return;

        gBrush.call(brush.move, null);

        if (!brushMode) {
            // the shift key has been release before we ended our brushing
            gBrush.remove();
            gBrush = null;
        }

        brushing = false;
    };

    /** 시프트 키를 눌렀을 경우 브러쉬 모드로 변경 */
    function keydown() {

        shiftKey = d3.event.shiftKey;

        if (shiftKey) {
            // if we already have a brush, don't do anything
            if (gBrush)
                return;

            brushMode = true;

            if (!gBrush) {
                gBrush = gBrushHolder.append('g');
                gBrush.call(brush);
            }
        }
    };

    /** 시프트키를 누르고 있지 않으면 브러쉬 모드 종료 */
    function keyup() {

        shiftKey = false;
        brushMode = false;

        if (!gBrush)
            return;

        if (!brushing) {
            // only remove the brush if we're not actively brushing
            // otherwise it'll be removed when the brushing ends
            gBrush.remove();
            gBrush = null;
        }
    };

    /** Simulation tick  */
    function ticked(e) {

        node
            .attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });

        text
            .attr("x", function(d) { return d.x; })
            .attr("y", function(d) { return d.y; });


        // !! 우선 노드의 중심이 끝점이 되도록 path 를 그린후
        link.attr("d", function(d) {
            return arcPath(true, d);
        });


        // !! 원의 반지름 만큼 길이를 줄여서 다시그림
        // https://stackoverflow.com/questions/41226734/align-marker-on-node-edges-d3-force-layout/41229068#41229068
        link.attr("d", function(d) {
            var pl = this.getTotalLength();
            var r = d.target.size * .5; // !! circle size를 가변적으로 처리 가능
            var m = this.getPointAtLength(pl - r);
            return arcPath(true, d, m);
        });

        pathInvis.attr("d", function(d) {
            return arcPath(d.source.x < d.target.x, d);
        });

        linkLabels
        .attr("x", function(d) {
            return ((d.source.x + d.target.x) / 2);
        })
        .attr("y", function(d) {
            return ((d.source.y + d.target.y) / 2);
        });


    };//END ticked
/** <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< */


/** UPDATE >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> */

    /** 데이터셋이 변경되고 재시작을하면 Merge기능을 수행할 함수 */
    function updateGraph() {

        console.log('Update graph .. ');

        /** 업데이트할 노드 */
        node = node.data(nodes, function(d) { return d.id;});
        node.exit().remove();
        node = node
                .enter().append("circle")
                .attr("class", "node")
                .attr("id", function(d) { return d.id })
                .attr("stroke", "white")
                .attr("stroke-width", "2px")
                .attr("fill", function(d) { return d.nodeColor } )
                .attr("data-text", function(d) { return d.name })
                .attr("r", function(d) { return d.size / 2 })
                //노드 클릭
                .on('click', nodeClick)
                //드래그
                .call(d3.drag()
                        .on("start", dragstarted)
                        .on("drag", dragged)
                        .on("end", dragended))
                .merge(node);


        /** 업데이트할 엣지 */
        link = link.data(links, function(d) { return d.id });
        link.exit().remove();
        link = link
                .enter()
                .append("path")
                .attr('id', function(d) { return d.id; })
                .attr("class", "link")
                .attr("stroke-width", function(d) { return d.value; })
                .attr("stroke", function(d) { return d.linkColor })
                .attr('marker-end', function(d) { return 'url(#arrowhead'+d.id+')'; })
                .merge(link);


        /** Pathlnvis ( 아치형 Link 를 위해서 필요 ) */
        pathInvis = pathInvis.data(links, function(d) { return d.source + "-" + d.target; });
        pathInvis.exit().remove();
        pathInvis = pathInvis
                .enter()
                .append("path")
                .attr("class", "invis")
                .attr("id",function(d) { return "invis_" + d.source + "-" + d.value + "-" + d.target; })
                .merge(pathInvis);


        /** 업데이트할 노드 라벨 */
        text = text.data(nodes, function(d) { return d.id;});
        text.exit().remove();
        text = text
                .enter()
                .append("text")
                .attr("class", "labels")
                .attr("dy", function(d) { return d.size / 7 })
                .attr("text-anchor", "middle")
                .attr("font-weight", "bold")
                .attr("font-size", function(d) { return d.size / 4 })
                .text(function(d) {return d.name})
                .attr("fill", function(d) { return d.textColor })
                .on('mouseover', function() {
                    d3.select(this).style('fill', 'yellow');
                })
                .on('mouseleave', function() {
                    d3.select(this).style('fill', nodes.textColor );
                })
                .merge(text);


        /** 링크 텍스트 */
        linkLabels = linkLabels.data(links, function(d) { return d.id;});
        linkLabels.exit().remove();
        linkLabels = linkLabels
                        .enter()
                        .append('text')
                        .append('textPath')
                        .attr("class","linkLabels")
                        .attr("fill", function(d) { return d.textColor; })
                        .attr("data-id", function(d) { return d.id; })
                        .attr("font-size", "15px")
                        .attr("startOffset", "50%")
                        .attr("text-anchor", "middle")
                        .attr("xlink:href", function(d) { return "#invis_" + d.source + "-" + d.value + "-" + d.target; })
                        .text(function(d) { return d.type; })
                        .on('mouseover', function() {
                            d3.select(this).style('fill', 'yellow');
                        })
                        .on('mouseleave', function() {
                            d3.select(this).style('fill', links.textColor );
                        })
                        //링크 텍스트 클릭
                        .on('click',linkClick)
                        .merge(linkLabels);


        /** simulation 재시작 */
        simulation.nodes(nodes);
        simulation.force("link").links(links);
        simulation.alphaTarget(0.3).restart();

        //노드와 노드간에 연결관계를 따질때 필요한 변수
        linkedByIndex = {};
        links.forEach((d) => {
          linkedByIndex[`${d.source.index},${d.target.index}`] = true;
        });

    };//END restart
/** <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< */

/** Draw >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> */

    /** Draw graph */
    function drawGraph(){

        console.log("Graph draw start..");

        /** 레이어 클릭 이벤트 */
        svg.on('click', layerClick);

        /** 화살표 태그 추가 */
        fnAddArrowTag();

        /** Zoom css 적용 */
        svg.attr("class","zoom"); // zoom

        var gMain = svg.append('g');

        /** Zoom Layer */
        zoomLayer = gMain
                        .append("rect")
                        .attr('width', width)
                        .attr('height', height);

        /** Zoom Event*/
        var zoom = d3.zoom().on('zoom', zoomed)
        gMain.call(zoom);

        function zoomed(){
            gDraw.attr("transform", d3.event.transform);
        };

        /** Draw tag */
        var gDraw = gMain.append('g');

        /** link g태그 설정 */
        link = gDraw.append("g").attr("class", "link").selectAll(".link");

        /** 아치형 링크를 만들기위하면 설정 */
        pathInvis = gDraw.append("g").attr("class", "invis").selectAll(".invis");

        // 아래 변수 두개는 node를 만들기 전에 선언해줘야함.
        gBrushHolder = gDraw.append('g');
        gBrush = null;

        /** node g태그 설정  */
        node = gDraw.append("g").attr("class", "node").selectAll(".node");

        /** node label g태그 설정 */
        text = gDraw.append("g").attr("class", "labels").selectAll(".labels");

        /** Link Label g태그 설정 */
        linkLabels = gDraw.append("g").attr("class","linkLabels").selectAll(".linkLabels");


        /** 노드 다중선택 브러쉬 기능 세팅 */
        brushMode = false;
        brushing = false;

        brush = d3.brush()
            .on("start", brushstarted)
            .on("brush", brushed)
            .on("end", brushended);

        d3.select('body').on('keydown', keydown);
        d3.select('body').on('keyup', keyup);


        /** Simulation */
        simulation = d3.forceSimulation(nodes)
                        .force('charge',d3.forceManyBody().strength(-1500))
                        .force("center_force", center_force)
                        .force("link", d3.forceLink().id(function(d) { return d.id; }).distance(100))
                        .force("fx", d3.forceX())
                        .force("fy", d3.forceY())
                        .on("tick", ticked);


        /** updateGraph */
        updateGraph();

    };// END drawGraph()
/** <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< */

    /** RETURN */
    return {

        //그래프 렌더링
        draw: function(){
            init();
            drawGraph();
        },

        //그래프 업데이트
        updateGraph: function(nodesData, linksData){

            nodes = [];
            nodes = nodesData;
            links = [];
            links = linksData;

            updateGraph();

        },

        //Expand Node
        expandNodes: function(){

            fnAddArrowTag();
            fnResetFindNeighbor();
            return updateGraph();
        },

        //노드 데이터 확인
        getNode: function(){
            return nodes;
        },

        //노드 데이터 Set
        setNode: function(nodeData){
            return nodes.push(nodeData);
        },

        //링크 데이터 확인
        getLink: function(){
            return links;
        },

        //링크 데이터 Set
        setLink: function(linkData){
            return links.push(linkData);
        },

        simulation: function(){
            return simulation;
        }

    };


};//END graphModule
