'use strict';

module.exports = function (runtime) {

  // Logger
  const log = require('../logger')(runtime);
  const paper = require('paper/dist/paper-core');
  const $p = require('./metadata')(runtime);
  const EditorInvisible = require('windowbuilder/public/dist/drawer')({$p, paper});

  /**
   * Невизуальный редактор
   */
  class Editor extends EditorInvisible {

    constructor(format = 'png') {

      super();

      // создаём экземпляр проекта Scheme
      this.create_scheme(format);
    }


    /**
     * Создаёт проект с заданным типом канваса
     * @param format
     */
    create_scheme(format = 'png') {
      const _canvas = paper.createCanvas(480, 480, format); // собственно, канвас
      _canvas.style.backgroundColor = '#f9fbfa';
      new EditorInvisible.Scheme(_canvas, this, true);
      const {view} = this.project;
      view._element = _canvas;
      if(!view._countItemEvent) {
        view._countItemEvent = function () {};
      }
    }
  }
  $p.Editor = Editor;

  const executer = require('./executer')($p, log);
  log('paper: required, inited & modified');

  return {executer, $p};
};
