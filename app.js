// global vars
var width = window.innerWidth - 50, // ugly adjustment to prevent scroll bar
  height = window.innerHeight,
  circleWidth = 5,
  arrow = '#dcdcdc',
  basic = '#a9a9a9',
  important = '#ba55d3';

var svg, nodes, lastNodeId, links, force, drag_line, path, circle;

// mouse event vars
var selected_node = null,
  selected_link = null,
  mousedown_link = null,
  mousedown_node = null,
  mouseup_node = null;

var jsonIo = document.getElementById('json-inout');

function resetMouseVars() {
  mousedown_node = null;
  mouseup_node = null;
  mousedown_link = null;
}

// update force layout (called automatically each iteration)
function tick() {
  // draw directed edges with proper padding from node centers
  path.attr('d', function(d) {
    var deltaX = d.target.x - d.source.x,
      deltaY = d.target.y - d.source.y,
      dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
      normX = deltaX / dist,
      normY = deltaY / dist,
      sourcePadding = d.left ? circleWidth + 5 : circleWidth,
      targetPadding = d.right ? circleWidth + 5 : circleWidth,
      sourceX = d.source.x + (sourcePadding * normX),
      sourceY = d.source.y + (sourcePadding * normY),
      targetX = d.target.x - (targetPadding * normX),
      targetY = d.target.y - (targetPadding * normY);
    return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
  });

  circle.attr('transform', function(d) {
    return 'translate(' + d.x + ',' + d.y + ')';
  });
}

// update graph (called when needed)
function restart() {
  // path (link) group
  path = path.data(links);

  // update existing links
  path.classed('selected', function(d) { return d === selected_link; })
    .style('marker-start', function(d) { return d.left ? 'url(#start-arrow)' : ''; })
    .style('marker-end', function(d) { return d.right ? 'url(#end-arrow)' : ''; });


  // add new links
  path.enter().append('svg:path')
    .attr('class', 'link')
    .classed('selected', function(d) { return d === selected_link; })
    .style('marker-start', function(d) { return d.left ? 'url(#start-arrow)' : ''; })
    .style('marker-end', function(d) { return d.right ? 'url(#end-arrow)' : ''; })
    .style('stroke-width', '1px')
    .style('fill', 'none')
    .style('stroke', arrow)
    .on('mousedown', function(d) {
      if (d3.event.ctrlKey) return;

      // select link
      mousedown_link = d;
      if (mousedown_link === selected_link) selected_link = null;
      else selected_link = mousedown_link;
      selected_node = null;
      restart();
    });

  // remove old links
  path.exit().remove();


  // circle (node) group
  // NB: the function arg is crucial here! nodes are known by id, not by index!
  circle = circle.data(nodes, function(d) { return d.id; });

  // update existing nodes (reflexive & selected visual states)
  circle.selectAll('circle')
    .style('fill', function(d) { return (d === selected_node) ? d3.rgb(d.color).brighter().toString() : d.color; })
    .classed('reflexive', function(d) { return d.reflexive; });

  // add new nodes
  var g = circle.enter().append('svg:g');

  g.append('svg:circle')
    .attr('class', 'node')
    .attr('r', circleWidth)
    .style('fill', function(d) { return (d === selected_node) ? d3.rgb(d.color).brighter().toString() : d.color; })
    .style('stroke', function(d) { return d3.rgb(d.color).darker().toString(); })
    .classed('reflexive', function(d) { return d.reflexive; })
    .on('mouseover', function(d) {
      if (!mousedown_node || d === mousedown_node) return;
      // enlarge target node
      d3.select(this).attr('transform', 'scale(1.1)');
    })
    .on('mouseout', function(d) {
      if (!mousedown_node || d === mousedown_node) return;
      // unenlarge target node
      d3.select(this).attr('transform', '');
    })
    .on('mousedown', function(d) {
      if (d3.event.ctrlKey) return;

      if (d3.event.shiftKey) {
        // prompt for new name and show it
        d.name = prompt('Set new name:', d.name);
        this.nextSibling.innerHTML = d.name;
        // .select('text')
        // .text(function(d) { return d.name; });
        return;
      }

      // select node
      mousedown_node = d;
      if (mousedown_node === selected_node) selected_node = null;
      else selected_node = mousedown_node;
      selected_link = null;

      // reposition drag line
      drag_line
        .style('marker-end', 'url(#end-arrow)')
        .classed('hidden', false)
        .attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + mousedown_node.x + ',' + mousedown_node.y);

      restart();
    })
    .on('mouseup', function(d) {
      if (!mousedown_node) return;

      // needed by FF
      drag_line
        .classed('hidden', true)
        .style('marker-end', '');

      // check for drag-to-self
      mouseup_node = d;
      if (mouseup_node === mousedown_node) { resetMouseVars(); return; }

      // unenlarge target node
      d3.select(this).attr('transform', '');

      // add link to graph (update if exists)
      // NB: links are strictly source < target; arrows separately specified by booleans
      var source, target, direction;
      if (mousedown_node.id < mouseup_node.id) {
        source = mousedown_node;
        target = mouseup_node;
        direction = 'right';
      } else {
        source = mouseup_node;
        target = mousedown_node;
        direction = 'left';
      }

      var link;
      link = links.filter(function(l) {
        return (l.source === source && l.target === target);
      })[0];

      if (link) {
        link[direction] = true;
      } else {
        link = { source: source, target: target, left: false, right: false };
        link[direction] = true;
        links.push(link);
      }

      // select new link
      selected_link = link;
      selected_node = null;
      restart();
    });

  // show node IDs
  g.append('svg:text')
    .text(function(d, i) { return d.name; })
    .attr('x', function(d, i) { return circleWidth + 5; })
    .attr('y', function(d, i) { return circleWidth + 0; })
    .attr('text-anchor', function(d, i) { return 'beginning'; });

  // remove old nodes
  circle.exit().remove();

  // set the graph in motion
  force.start();
}

function mousedown() {
  // prevent I-bar on drag
  //d3.event.preventDefault();

  // because :active only works in WebKit?
  svg.classed('active', true);

  if (d3.event.ctrlKey || d3.event.shiftKey || mousedown_node || mousedown_link) return;

  // insert new node at point
  var point = d3.mouse(this),
    node = { id: ++lastNodeId, reflexive: false };
  node.x = point[0];
  node.y = point[1];
  // color based on whether click was left or right
  node.color = d3.event.which == 1 ? basic : important;
  node.name = 'Change me!';
  nodes.push(node);

  restart();
}

function mousemove() {
  if (!mousedown_node) return;

  // update drag line
  drag_line.attr('d', 'M' + mousedown_node.x + ',' + mousedown_node.y + 'L' + d3.mouse(this)[0] + ',' + d3.mouse(this)[1]);

  restart();
}

function mouseup() {
  if (mousedown_node) {
    // hide drag line
    drag_line
      .classed('hidden', true)
      .style('marker-end', '');
  }

  // because :active only works in WebKit?
  svg.classed('active', false);

  // clear mouse event vars
  resetMouseVars();
}

function spliceLinksForNode(node) {
  var toSplice = links.filter(function(l) {
    return (l.source === node || l.target === node);
  });
  toSplice.map(function(l) {
    links.splice(links.indexOf(l), 1);
  });
}

// only respond once per keydown
var lastKeyDown = -1;

function keydown() {
  // d3.event.preventDefault();

  if (lastKeyDown !== -1) return;
  lastKeyDown = d3.event.keyCode;

  // ctrl
  if (d3.event.keyCode === 17) {
    circle.call(force.drag);
    svg.classed('ctrl', true);
  }

  if (!selected_node && !selected_link) return;
  switch (d3.event.keyCode) {
    case 8: // backspace
    case 46: // delete
      if (selected_node) {
        nodes.splice(nodes.indexOf(selected_node), 1);
        spliceLinksForNode(selected_node);
      } else if (selected_link) {
        links.splice(links.indexOf(selected_link), 1);
      }
      selected_link = null;
      selected_node = null;
      restart();
      break;
    case 66: // B
      if (selected_link) {
        // set link direction to both left and right
        selected_link.left = true;
        selected_link.right = true;
      }
      restart();
      break;
    case 76: // L
      if (selected_link) {
        // set link direction to left only
        selected_link.left = true;
        selected_link.right = false;
      }
      restart();
      break;
    case 82: // R
      if (selected_node) {
        // toggle node reflexivity
        selected_node.reflexive = !selected_node.reflexive;
      } else if (selected_link) {
        // set link direction to right only
        selected_link.left = false;
        selected_link.right = true;
      }
      restart();
      break;
  }
}

function keyup() {
  lastKeyDown = -1;

  // ctrl
  if (d3.event.keyCode === 17) {
    circle
      .on('mousedown.drag', null)
      .on('touchstart.drag', null);
    svg.classed('ctrl', false);
  }
}

// send svg to server side script for downloading
function saveSVG() {
  // Get the d3js SVG element
  var tmp = document.getElementById("svg");
  var svg = tmp.getElementsByTagName("svg")[0];
  // Extract the data as SVG text string
  var svg_xml = (new XMLSerializer).serializeToString(svg);

  // Submit the <FORM> to the server.
  // The result will be an attachment file to download.
  var form = document.getElementById("svgform");
  form['data'].value = svg_xml;
  form.submit();
}

function ref2id(linkArray) {
  var ans = [];
  for (var i = 0; i < linkArray.length; i++) {
    var link = Object.assign({}, linkArray[i]);
    link.source = linkArray[i].source.id;
    link.target = linkArray[i].target.id;
    ans.push(link);
  }
  return ans;
}

function getNodeById(nodeArray, id) {
  for (var i = 0; i < nodeArray.length; i++) {
    var node = nodes[i];
    if (node.id === id) {
      return node;
    }
  }
}

function id2ref(linkArray, nodeArray) {
  var ans = [];
  for (var i = 0; i < linkArray.length; i++) {
    var link = Object.assign({}, linkArray[i]);
    link.source = getNodeById(nodeArray, linkArray[i].source);
    link.target = getNodeById(nodeArray, linkArray[i].target);
    ans.push(link);
  }
  return ans;
}

function dumpJSON() {
  var jsonString = JSON.stringify({
    nodes: nodes,
    lastNodeId: lastNodeId,
    links: ref2id(links)
  });
  jsonIo.value = jsonString;
  init();
}

function loadJSON() {
  var json = JSON.parse(jsonIo.value);
  nodes = json.nodes;
  lastNodeId = json.lastNodeId;
  links = id2ref(json.links, nodes);
  init();
}

function init() {
  // remove the svg element if it already exists (i.e. we're re-initializing by
  // loading a graph from JSON)
  var svgDiv = document.getElementById("svg");
  var svgElem = svgDiv.getElementsByTagName("svg")[0];
  if (svgElem) svgDiv.removeChild(svgElem);

  svg = d3.select('#svg')
    .append('svg')
    .attr('oncontextmenu', 'return false;')
    .attr('width', width)
    .attr('height', height);

  // set up initial nodes and links
  //  - nodes are known by 'id', not by index in array.
  //  - reflexive edges are indicated on the node (as a bold black circle).
  //  - links are always source < target; edge directions are set by 'left' and 'right'.
  nodes = (typeof nodes === 'undefined') ? [
    { id: 0, reflexive: false, color: important, name: 'Scroll ...' },
    { id: 1, reflexive: true, color: basic, name: '... down ...' },
    { id: 2, reflexive: false, color: basic, name: '... for help :)' }
  ] : nodes;
  lastNodeId = (typeof lastNodeId === 'undefined') ? 2 : lastNodeId;
  links = (typeof links === 'undefined') ? [
    { source: nodes[0], target: nodes[1], left: false, right: true },
    { source: nodes[1], target: nodes[2], left: false, right: true }
  ] : links;

  // init D3 force layout
  force = d3.layout.force()
    .nodes(nodes)
    .links(links)
    .size([width, height])
    .linkDistance(150)
    .charge(-500)
    .on('tick', tick);

  // define arrow markers for graph links
  svg.append('svg:defs').append('svg:marker')
    .attr('id', 'end-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 6)
    .attr('markerWidth', 9)
    .attr('markerHeight', 9)
    .attr('orient', 'auto')
    .append('svg:path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', arrow);

  svg.append('svg:defs').append('svg:marker')
    .attr('id', 'start-arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 4)
    .attr('markerWidth', 9)
    .attr('markerHeight', 9)
    .attr('orient', 'auto')
    .append('svg:path')
    .attr('d', 'M10,-5L0,0L10,5')
    .attr('fill', arrow);

  // line displayed when dragging new nodes
  drag_line = svg.append('svg:path')
    .attr('class', 'link dragline hidden')
    .attr('d', 'M0,0L0,0');

  // handles to link and node element groups
  path = svg.append('svg:g').selectAll('path');
  circle = svg.append('svg:g').selectAll('g');

  svg.on('mousedown', mousedown)
    .on('mousemove', mousemove)
    .on('mouseup', mouseup);
  d3.select(window)
    .on('keydown', keydown)
    .on('keyup', keyup);
  restart();
}

// app starts here
init();
