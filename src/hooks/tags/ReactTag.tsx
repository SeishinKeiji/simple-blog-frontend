import React, { Component, createRef, useState, useEffect, useRef } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { isEqual, noop, uniq } from "lodash";
import ClearAllTags from "./ClearAllTags";
import Suggestions from "./Suggestions";
import ClassNames from "classnames";
import Tag from "./Tag";

import { buildRegExpFromDelimiters } from "../../lib/utils";

import { KEYS, DEFAULT_PLACEHOLDER, DEFAULT_CLASSNAMES, DEFAULT_LABEL_FIELD, INPUT_FIELD_POSITIONS } from "../../lib/constants";
import { ReactTagsPropTypes, ReactTagTypes } from "../../lib/types";

const ReactTags = (props: ReactTagTypes) => {
  const [state, setState] = useState({
    suggestions: props.suggestions,
    query: "",
    isFocused: false,
    selectedIndex: -1,
    selectionMode: false,
    ariaLiveStatus: "",
    currentEditIndex: -1,
  });
  const reactTagsRef = createRef();
  const inputTextRef = createRef();
  const tagInputRef = useRef<HTMLInputElement | null>(null);

  const addTag = (tag) => {
    const { tags, labelField, allowUnique } = props;
    const { currentEditIndex } = state;
    if (!tag.id || !tag[labelField]) {
      return;
    }
    const existingKeys = tags.map((tag) => tag.id.toLowerCase());

    // Return if tag has been already added
    if (allowUnique && existingKeys.indexOf(tag.id.toLowerCase()) >= 0) {
      return;
    }
    if (props.autocomplete) {
      const possibleMatches = filteredSuggestions(tag[labelField]);

      if ((props.autocomplete === 1 && possibleMatches.length === 1) || (props.autocomplete === true && possibleMatches.length)) {
        tag = possibleMatches[0];
      }
    }

    // call method to add
    if (currentEditIndex !== -1 && props.onTagUpdate) props.onTagUpdate(currentEditIndex, tag);
    else props.handleAddition(tag);

    // reset the state
    setState((currentState) => ({
      ...state,
      query: "",
      selectionMode: false,
      selectedIndex: -1,
      currentEditIndex: -1,
    }));

    resetAndFocusInput();
  };

  const handleFocus = (event) => {
    const value = event.target.value;
    if (props.handleInputFocus) {
      props.handleInputFocus(value);
    }
    setState((currentState) => ({ ...currentState, isFocused: true }));
  };

  const handleBlur = (event) => {
    const value = event.target.value;
    if (props.handleInputBlur) {
      props.handleInputBlur(value);
      if (inputTextRef.current) {
        inputTextRef.current.value = "";
      }
    }
    setState((currentState) => ({ ...currentState, isFocused: false, currentEditIndex: -1 }));
  };

  const handleKeyDown = (event) => {
    const { query, selectedIndex, suggestions, selectionMode } = state;

    // hide suggestions menu on escape
    if (event.keyCode === KEYS.ESCAPE) {
      event.preventDefault();
      event.stopPropagation();
      setState((currentState) => ({
        ...currentState,
        selectedIndex: -1,
        selectionMode: false,
        suggestions: [],
        currentEditIndex: -1,
      }));
    }

    // When one of the terminating keys is pressed, add current query to the tags.
    // If no text is typed in so far, ignore the action - so we don't end up with a terminating
    // character typed in.
    if (props.delimiters.indexOf(event.keyCode) !== -1 && !event.shiftKey) {
      if (event.keyCode !== KEYS.TAB || query !== "") {
        event.preventDefault();
      }

      const selectedQuery = selectionMode && selectedIndex !== -1 ? suggestions[selectedIndex] : { id: query, [props.labelField]: query };

      if (selectedQuery !== "") {
        addTag(selectedQuery);
      }
    }

    // when backspace key is pressed and query is blank, delete tag
    if (event.keyCode === KEYS.BACKSPACE && query === "" && props.allowDeleteFromEmptyInput) {
      props.handleDelete(props.tags.length - 1, e);
    }

    // up arrow
    if (event.keyCode === KEYS.UP_ARROW) {
      event.preventDefault();
      setState((currentState) => ({
        ...currentState,
        selectedIndex: selectedIndex <= 0 ? suggestions.length - 1 : selectedIndex - 1,
        selectionMode: true,
      }));
    }

    // down arrow
    if (event.keyCode === KEYS.DOWN_ARROW) {
      event.preventDefault();
      setState((currentState) => ({
        ...currentState,
        selectedIndex: suggestions.length === 0 ? -1 : (selectedIndex + 1) % suggestions.length,
        selectionMode: true,
      }));
    }
  };

  const handleChange = (event) => {
    if (props.handleInputChange) {
      props.handleInputChange(event.target.value);
    }

    const query = e.target.value.trim();

    setState({ query }, updateSuggestions);
  };

  const handlePaste = (event) => {
    if (!props.allowAdditionFromPaste) {
      return;
    }

    event.preventDefault();

    const clipboardData = event.clipboardData || window.clipboardData;
    const clipboardText = clipboardData.getData("text");

    const { maxLength = clipboardText.length } = props;

    const maxTextLength = Math.min(maxLength, clipboardText.length);
    const pastedText = clipboardData.getData("text").substr(0, maxTextLength);

    // Used to determine how the pasted content is split.
    const delimiterRegExp = buildRegExpFromDelimiters(props.delimiters);
    const tags = pastedText.split(delimiterRegExp);

    // Only add unique tags
    uniq(tags).forEach((tag) => addTag({ id: tag, [props.labelField as string]: tag }));
  };

  const handleSuggestionHover = (i) =>
    setState((currentState) => ({
      ...currentState,
      selectedIndex: i,
      selectionMode: true,
    }));

  const handleSuggestionClick = (i) => addTag(state.suggestions[i]);

  const handleTagClick = (i, tag, e) => {
    const { editable, handleTagClick, labelField } = props;
    if (editable) {
      setState((currentState) => ({ ...currentState, currentEditIndex: i, query: tag[labelField] }));
      tagInput.focus();
    }
    if (handleTagClick) {
      handleTagClick(i, e);
    }
  };

  const moveTag = (dragIndex: number, hoverIndex: number) => {
    const tags = props.tags;

    // locate tags
    const dragTag = tags[dragIndex];

    // call handler with the index of the dragged tag
    // and the tag that is hovered
    props.handleDrag(dragTag, dragIndex, hoverIndex);
  };

  const getTagItems = () => {
    const { tags, labelField, removeComponent, readOnly, allowDragDrop } = props;
    const classNames = { ...DEFAULT_CLASSNAMES, ...props.classNames };

    const { currentEditIndex, query } = state;
    const moveTag = allowDragDrop ? moveTag : null;
    return tags.map((tag, index) => {
      return (
        <React.Fragment key={index}>
          {currentEditIndex === index ? (
            <div className={classNames.editTagInput}>
              <input
                ref={(input) => {
                  tagInputRef.current = input;
                }}
                onFocus={handleFocus}
                value={query}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className={classNames.editTagInputField}
                onPaste={handlePaste}
                data-testid="tag-edit"
              />
            </div>
          ) : (
            <Tag
              index={index}
              tag={tag}
              labelField={labelField}
              onDelete={props.handleDelete.bind(this, index)}
              moveTag={moveTag}
              removeComponent={removeComponent}
              onTagClicked={handleTagClick.bind(this, index, tag)}
              readOnly={readOnly}
              classNames={classNames}
              allowDragDrop={allowDragDrop}
            />
          )}
        </React.Fragment>
      );
    });
  };

  const tagInput = !this.props.readOnly ? (
    <div className={classNames.tagInput}>
      <input
        {...inputProps}
        ref={(input) => {
          this.textInput = input;
        }}
        className={classNames.tagInputField}
        type="text"
        placeholder={placeholder}
        aria-label={placeholder}
        onFocus={this.handleFocus}
        onBlur={this.handleBlur}
        onChange={this.handleChange}
        onKeyDown={this.handleKeyDown}
        onPaste={this.handlePaste}
        name={inputName}
        id={inputId}
        maxLength={maxLength}
        value={inputValue}
        data-automation="input"
        data-testid="input"
      />

      <Suggestions
        query={query}
        suggestions={suggestions}
        labelField={this.props.labelField}
        selectedIndex={selectedIndex}
        handleClick={this.handleSuggestionClick}
        handleHover={this.handleSuggestionHover}
        minQueryLength={this.props.minQueryLength}
        shouldRenderSuggestions={this.props.shouldRenderSuggestions}
        isFocused={this.state.isFocused}
        classNames={classNames}
        renderSuggestion={this.props.renderSuggestion}
      />
      {clearAll && tags.length > 0 && <ClearAllTags classNames={classNames} onClick={this.clearAll} />}
    </div>
  ) : null;

  return (
    <div className={ClassNames(classNames.tags, "react-tags-wrapper")} ref={this.reactTagsRef}>
      <p
        role="alert"
        className="sr-only"
        style={{
          position: "absolute",
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          margin: "-1px",
          padding: 0,
          width: "1px",
          height: "1px",
          border: 0,
        }}
      >
        {this.state.ariaLiveStatus}
      </p>
      {position === INPUT_FIELD_POSITIONS.TOP && tagInput}
      <div className={classNames.selected}>
        {tagItems}
        {position === INPUT_FIELD_POSITIONS.INLINE && tagInput}
      </div>
      {position === INPUT_FIELD_POSITIONS.BOTTOM && tagInput}
    </div>
  );
};

const WithContext = ({ ...props }) => (
  <DndProvider backend={HTML5Backend}>
    <ReactTags {...props} />
  </DndProvider>
);

ReactTags.defaultProps = {
  placeholder: DEFAULT_PLACEHOLDER,
  labelField: DEFAULT_LABEL_FIELD,
  suggestions: [],
  delimiters: [...KEYS.ENTER, KEYS.TAB],
  autofocus: true,
  inline: true, // TODO: Remove in v7.x.x
  inputFieldPosition: INPUT_FIELD_POSITIONS.INLINE,
  handleDelete: noop,
  handleAddition: noop,
  allowDeleteFromEmptyInput: true,
  allowAdditionFromPaste: true,
  autocomplete: false,
  readOnly: false,
  allowUnique: true,
  allowDragDrop: true,
  tags: [],
  inputProps: {},
  onTagUpdate: noop,
  editable: false,
  clearAll: false,
  handleClearAll: noop,
};

ReactTags.propTypes = ReactTagsPropTypes;

export { WithContext };
export { ReactTags as WithOutContext };
export { KEYS };
