var Util = require('../util/common');

var Marker = require('./marker');

var Container = require('./list');

var GAP = 4;

var Tooltip =
/*#__PURE__*/
function () {
  var _proto = Tooltip.prototype;

  _proto.getDefaultCfg = function getDefaultCfg() {
    return {
      /**
       * wether show the crosshairs
       * @type {Object}
       */
      showCrosshairs: false,

      /**
       * the style for crosshairs
       * @type {Object}
       */
      crosshairsStyle: {
        stroke: 'rgba(0, 0, 0, 0.25)',
        lineWidth: 1
      },

      /**
       * the style for tooltip container's background
       * @type {Object}
       */
      background: null,

      /**
       * layout, can be horizontal or vertical
       * @type {String}
       */
      layout: 'horizontal',
      offsetX: 0,
      offsetY: 0
    };
  };

  function Tooltip(cfg) {
    Util.deepMix(this, this.getDefaultCfg(), cfg);
    var frontPlot = this.frontPlot;
    var plotRange = this.plotRange;

    if (!this.custom) {
      // custom means user do customize
      var container = new Container(Util.mix({
        parent: frontPlot,
        zIndex: 3
      }, cfg));
      this.container = container;

      if (!this.fixed) {
        this.tooltipArrow = frontPlot.addShape('Polygon', {
          className: 'tooltip-arrow',
          visible: false,
          zIndex: 2,
          attrs: {
            points: [],
            fill: this.background.fill
          }
        });
      }
    }

    if (this.showCrosshairs) {
      var crosshairsStyle = this.crosshairsStyle;
      var shape = frontPlot.addShape('Line', {
        className: 'tooltip-crosshairs',
        zIndex: 0,
        visible: false,
        attrs: Util.mix({
          x1: 0,
          y1: plotRange.bl.y,
          x2: 0,
          y2: plotRange.tl.y
        }, crosshairsStyle)
      });
      this.crosshairsShape = shape;
    }

    frontPlot.sort();
  }

  _proto.setContent = function setContent(title, items) {
    this.title = title;
    this.items = items;
    var container = this.container;
    container.setTitle(title);
    container.setItems(items);
  };

  _proto.setPosition = function setPosition(items) {
    var container = this.container,
        plotRange = this.plotRange,
        offsetX = this.offsetX,
        offsetY = this.offsetY,
        crosshairsShape = this.crosshairsShape,
        fixed = this.fixed,
        tooltipArrow = this.tooltipArrow;
    crosshairsShape && crosshairsShape.moveTo(items[0].x, 0);

    if (!container) {
      return;
    }

    var containerBBox = container.container.getBBox();
    var minX = containerBBox.minX,
        minY = containerBBox.minY,
        width = containerBBox.width,
        height = containerBBox.height;
    var tl = plotRange.tl,
        tr = plotRange.tr;
    var posX = 0;
    var posY = tl.y - height - GAP + offsetY;

    if (fixed) {
      var x = (tl.x + tr.x) / 2;
      posX = x - width / 2 + offsetX;
    } else {
      var _x;

      if (items.length > 1) {
        _x = (items[0].x + items[items.length - 1].x) / 2;
      } else {
        _x = items[0].x;
      }

      posX = _x - width / 2 + offsetX;

      if (posX < tl.x) {
        posX = tl.x;
      }

      if (posX + width > tr.x) {
        posX = tr.x - width;
      }

      if (tooltipArrow) {
        tooltipArrow.attr('points', [{
          x: _x - 3,
          y: tl.y - GAP + offsetY
        }, {
          x: _x + 3,
          y: tl.y - GAP + offsetY
        }, {
          x: _x,
          y: tl.y + offsetY
        }]);
        var backShape = container.backShape;
        var radius = Util.parsePadding(backShape.attr('radius'));

        if (_x === tl.x) {
          radius[3] = 0;
          tooltipArrow.attr('points', [{
            x: tl.x,
            y: tl.y + offsetY
          }, {
            x: tl.x,
            y: tl.y - GAP + offsetY
          }, {
            x: tl.x + GAP,
            y: tl.y - GAP + offsetY
          }]);
        } else if (_x === tr.x) {
          radius[2] = 0;
          tooltipArrow.attr('points', [{
            x: tr.x,
            y: tl.y + offsetY
          }, {
            x: tr.x - GAP,
            y: tl.y - GAP + offsetY
          }, {
            x: tr.x,
            y: tl.y - GAP + offsetY
          }]);
        }

        backShape.attr('radius', radius);
      }
    }

    container.moveTo(posX - minX, posY - minY);
  };

  _proto.setMarkers = function setMarkers(cfg) {
    if (cfg === void 0) {
      cfg = {};
    }

    var self = this;
    var _cfg = cfg,
        items = _cfg.items,
        style = _cfg.style,
        type = _cfg.type;

    var markerGroup = self._getMarkerGroup(type);

    if (type === 'circle') {
      for (var i = 0, length = items.length; i < length; i++) {
        var item = items[i];
        var marker = new Marker({
          className: 'tooltip-circle-marker',
          attrs: Util.mix({
            x: item.x,
            y: item.y,
            stroke: item.color
          }, style)
        });
        markerGroup.add(marker);
      }
    } else {
      markerGroup.addShape('rect', {
        className: 'tooltip-rect-marker',
        attrs: style
      });
    }
  };

  _proto.clearMarkers = function clearMarkers() {
    var markerGroup = this.markerGroup;
    markerGroup && markerGroup.clear();
  };

  _proto.show = function show() {
    var crosshairsShape = this.crosshairsShape;
    var markerGroup = this.markerGroup;
    var container = this.container;
    var tooltipArrow = this.tooltipArrow;
    var canvas = this.canvas; // canvas.sort();

    crosshairsShape && crosshairsShape.show();
    markerGroup && markerGroup.show();
    container && container.show();
    tooltipArrow && tooltipArrow.show();
    canvas.draw();
  };

  _proto.hide = function hide() {
    var crosshairsShape = this.crosshairsShape;
    var markerGroup = this.markerGroup;
    var container = this.container;
    var tooltipArrow = this.tooltipArrow;
    crosshairsShape && crosshairsShape.hide();
    markerGroup && markerGroup.hide();
    container && container.hide();
    tooltipArrow && tooltipArrow.hide();
  };

  _proto.destroy = function destroy() {
    var crosshairsShape = this.crosshairsShape;
    var markerGroup = this.markerGroup;
    var container = this.container;
    var tooltipArrow = this.tooltipArrow;
    crosshairsShape && crosshairsShape.remove(true);
    markerGroup && markerGroup.remove(true);
    container && container.clear();
    tooltipArrow && tooltipArrow.remove(true);
    this.destroyed = true;
  };

  _proto._getMarkerGroup = function _getMarkerGroup(type) {
    var markerGroup = this.markerGroup;

    if (!markerGroup) {
      if (type === 'circle') {
        markerGroup = this.frontPlot.addGroup({
          zIndex: 1
        });
        this.frontPlot.sort();
      } else {
        markerGroup = this.backPlot.addGroup();
      }

      this.markerGroup = markerGroup;
    } else {
      markerGroup.clear();
    }

    return markerGroup;
  };

  return Tooltip;
}();

module.exports = Tooltip;