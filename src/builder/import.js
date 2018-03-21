'use strict';

import $p from './metadata';

const debug = require('debug')('wb:paper');

import paper from 'paper/dist/paper-core.js';

debug('required');

/**
 * Невизуальный редактор
 */
class Editor extends paper.PaperScope {

  constructor(format = 'png') {

    super();

    /**
     * Собственный излучатель событий для уменьшения утечек памяти
     */
    this.eve = new (Object.getPrototypeOf($p.md.constructor))();

    /**
     * fake-undo
     * @type {{clear(), save_snapshot()}}
     * @private
     */
    this._undo = {
      clear() {
      },
      save_snapshot() {
      },
    };

    // уточняем константы
    consts.tune_paper(this.settings);

    // создаём экземпляр проекта Scheme
    this.create_scheme(format);
  }

  /**
   * Заглушка установки заголовка редактора
   */
  set_text() {
  }

  /**
   * Возвращает элемент по номеру
   * @param num
   */
  elm(num) {
    return this.project.getItem({class: BuilderElement, elm: num});
  }

  /**
   * Создаёт проект с заданным типом канваса
   * @param format
   */
  create_scheme(format = 'png') {
    const _canvas = paper.createCanvas(480, 480, format); // собственно, канвас
    _canvas.style.backgroundColor = '#f9fbfa';
    this.setup(_canvas);
    new Scheme(_canvas, this, true);
  }
}

$p.Editor = Editor;

