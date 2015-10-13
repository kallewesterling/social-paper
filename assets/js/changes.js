/**
 * Social Paper Change Tracking Javascript
 *
 * @package Social_Paper
 * @subpackage Template
 */



/**
 * Create SocialPaperChange object.
 *
 * This works as a "namespace" of sorts, allowing us to hang properties, methods
 * and "sub-namespaces" from it.
 */
var SocialPaperChange = SocialPaperChange || {};



/**
 * Set up the SocialPaperChange when the page is ready
 */
jQuery(document).ready( function($) {

	/**
	 * Create Reporter object.
	 *
	 * This can be used to hold externally addressable utility functions.
	 */
	SocialPaperChange.reporter = new function() {

		/**
		 * Report the current state of the comments.
		 */
		this.comments = function() {
			SocialPaperChange.tracker.data.forEach( function( item ) {
				$( 'li[data-incom-comment="' + item.modified + '"]' ).each( function( i, el ) {
					console.log( 'comment: ', $(el).prop( 'id' ), $(el).attr( 'data-incom-comment' ) );
				});
			});
		};

	};

	/**
	 * Create Tracker object.
	 */
	SocialPaperChange.tracker = new function() {

		var me = this;

		// tracks the changes to content
		me.data = [];

		/**
		 * Init tracker array
		 */
		this.init = function() {

			me.data = [];

			// get current
			$('.fee-content-original').find( '[data-incom]' ).each( function( i, element ) {

				// construct default data
				var data = {
					is_new: false,
					is_modified: false,
					original: $(element).attr( 'data-incom' ),
					modified: $(element).attr( 'data-incom' ),
				};

				me.data.push( data );

			});

		};

		/**
		 * Rebuild tracker array
		 */
		this.rebuild = function() {

			me.data = [];

			// get current
			$('.fee-content-body').find( '[data-incom]' ).each( function( i, element ) {

				// construct default data
				var data = {
					is_new: false,
					is_modified: false,
					original: $(element).attr( 'data-incom' ),
					modified: $(element).attr( 'data-incom' ),
				};

				me.data.push( data );

			});

		};

		/**
		 * Add an item to the tracker array
		 */
		this.add = function( data ) {
			me.data.push( data );
		};

		/**
		 * Update an item in the tracker array
		 */
		this.update = function( data ) {

			// iterate through items and find relevant one
			me.data.forEach( function( item ) {
				if ( item.original == data.original ) {
					item = data;
					return false;
				}
			});

		};

		/**
		 * Delete an item from the tracker array
		 */
		this.remove = function( data ) {
			me.data.splice( $.inArray( data, me.data ), 1 );
		};

		/**
		 * Get an item from the tracker array
		 *
		 * @param str identifier The identifier to look for
		 * @param str property The property to match the identifier against
		 * @return object|bool found The data object for the identifier, or false if not found
		 */
		this.get_by = function( identifier, property ) {

			// init as not found
			var found = false;

			// find relevant one
			me.data.forEach( function( item ) {
				if (
					property == 'modified' && item.modified == identifier ||
					property == 'original' && item.original == identifier
				) {
					found = item;
					return false;
				}
			});

			if ( found ) {
				return found;
			} else {
				return false;
			}

		};

		/**
		 * Given an array of items, get those in the tracker array which are not
		 * present in the supplied array.
		 *
		 * This is used to find out which paragraphs have been deleted when there
		 * is an uncollapsed selection that we cannot determine the keydown items
		 * for. This applies to the ENTER and DELETE keys, for example.
		 *
		 * @param array items The array of items present in the DOM
		 * @return array missing The array of items missing from the DOM
		 */
		this.get_missing = function( items ) {

			var missing = [];

			// add to missing if the stored paragraph is not in the items
			$.each( me.data, function( index, value ) {
				if ( -1 === $.inArray( value.modified, items ) ) {
					missing.push( value.modified );
				}
			});

			return missing;

		};

	};

	/**
	 * Create Editor Tracking object.
	 */
	SocialPaperChange.editor = new function() {

		var me = this;

		// TinyMCE content editor instance
		me.instance = {};

		// items present when there's a uncollapsed selection on keydown
		me.keydown_items = [];

		// paste flag
		me.paste_flag = false;

		// non printing keycodes
		me.non_printing = {
			'12': 'num lock (mac)', '16': 'shift', '17': 'ctrl', '18': 'alt',
			'19': 'pause/break', '20': 'caps lock', '27': 'escape',
			'33': 'page up', '34': 'page down',
			'35': 'end', '36': 'home',
			'37': 'left arrow', '38': 'up arrow', '39': 'right arrow', '40': 'down arrow',
			'45': 'insert', '46': 'delete',
			'91': 'left window', '92': 'right window', '93': 'select',
			'112': 'f1', '113': 'f2', '114': 'f3', '115': 'f4', '116': 'f5',
			'117': 'f6', '118': 'f7', '119': 'f8', '120': 'f9', '121': 'f10',
			'122': 'f11', '123': 'f12', '124': 'f13', '125': 'f14', '126': 'f15',
			'127': 'f16', '128': 'f17', '129': 'f18', '130': 'f19',
			'144': 'num lock', '145': 'scroll lock'
		};

		/**
		 * Start tracking changes in the editor.
		 *
		 * NB: when keys are held down so that they repeatedly fire, only keydown
		 * events are triggered. This may have consequences for the method which
		 * handles printing character keys.
		 *
		 * Also, when a modifier is used (for example when cutting or pasting) no
		 * keyup event fires until the modifier key is released, at which point
		 * it is the modifier key's keyCode which is reported. Which means all
		 * cut/paste code can only work on keydown.
		 */
		this.track = function( event ) {

			// bail if already done
			if ( ! $.isEmptyObject( me.instance ) ) {
				return;
			}

			// store editor in our "global"
			me.instance = tinyMCE.get( window.wpActiveEditor );

			// add keydown tracker code
			me.instance.on( 'keydown', function( event ) {

				//console.log( 'keydown event code', event.which );

				// return?
				if ( event.which == tinymce.util.VK.ENTER ) {
					me.handle_ENTER();
					return;
				}

				// delete?
				if ( event.which == tinymce.util.VK.DELETE || event.which == tinymce.util.VK.BACKSPACE ) {
					me.handle_DELETE();
					return;
				}

				// any other key that produces a printing character
				if ( ! tinymce.util.VK.metaKeyPressed( event ) && ! ( ( event.which + '' ) in me.non_printing ) ) {
					me.handle_PRINTING_CHAR( 'keydown' );
				}

			});

			// add keyup tracker code
			me.instance.on( 'keyup', function( event ) {

				//console.log( 'keyup event code', event.which );

				// return?
				if ( event.which == tinymce.util.VK.ENTER ) {
					//me.handle_ENTER( 'keyup' );
					return;
				}

				// delete?
				if ( event.which == tinymce.util.VK.DELETE || event.which == tinymce.util.VK.BACKSPACE ) {
					//me.handle_DELETE( 'keyup' );
					return;
				}

				// any other key that produces a printing character
				if ( ! tinymce.util.VK.metaKeyPressed( event ) && ! ( ( event.which + '' ) in me.non_printing ) ) {
					me.handle_PRINTING_CHAR( 'keyup' );
				}

			});

			// handle cut
			me.instance.on( 'cut', function( event ) {
				me.handle_CUT( event );
			});

			// handle paste
			me.instance.on( 'PastePreProcess', function( event ) {
				//me.handle_PASTE_PRE( event );
			});
			me.instance.on( 'paste', function( event ) {
				//me.handle_PASTE( event );
			});
			me.instance.on( 'PastePostProcess', function( event ) {
				me.handle_PASTE_POST( event );
			});

			// change tracker
			me.instance.on( 'change', function( event ) {
				//console.log('change event', event);
				//console.log('change event type', event.type);
				me.handle_PASTE_COMPLETE( event );
			});

		};

		/**
		 * Handle 'PastePreProcess' event
		 *
		 * @param object event The TinyMCE event object
		 */
		this.handle_PASTE_PRE = function( event ) {
			//console.log( '------------------------------------------------------------' );
			//console.log( 'handle_PASTE_PRE', event );
		};

		/**
		 * Handle 'paste' event
		 *
		 * @param object event The TinyMCE event object
		 */
		this.handle_PASTE = function( event ) {
			//console.log( '------------------------------------------------------------' );
			//console.log( 'handle_PASTE', event );
		};

		/**
		 * Handle 'PastePostProcess' event
		 *
		 * This is a perhaps unreliable way to do this, but the problem is that
		 * during 'PastePostProcess', the new content has been added to the DOM
		 * but not inserted at the caret. This means that the order cannot be
		 * discovered.
		 *
		 * As a result, a flag is set here and then tested for in the callback
		 * to the 'change' event. See `handle_PASTE_COMPLETE()` below.
		 *
		 * @param object event The TinyMCE event object
		 */
		this.handle_PASTE_POST = function( event ) {

			//console.log( '------------------------------------------------------------' );
			//console.log( 'handle_PASTE_POST', event );
			me.paste_flag = true;

			// When cutting and pasting from the same TinyMCE instance, markup
			// may not be cleaned sufficiently - this can result in the 'style'
			// and 'data-incom' attributes remaining in the paste content. This
			// messes up the logic for finding the last identifiable item below.

			// remove class and data-incom attributes from any content
			items = $('<div>').html( event.node.innerHTML );
			items.find( '[data-incom]' ).each( function( i, element ) {
				element.removeAttribute( 'data-incom' );
				//element.removeAttribute( 'class' );
			});

			event.node.innerHTML = items.html();

		};

		/**
		 * Handle 'paste' event after the DOM has been built.
		 *
		 * This is a callback fromm the 'change' event and may be unreliable
		 * because for 'change' events to be triggered requires sufficient change
		 * to trigger an undo. Needs thorough testing.
		 *
		 * @param object event The TinyMCE event object
		 */
		this.handle_PASTE_COMPLETE = function( event ) {

			// only allow this to run directly after PastePostProcess
			if ( me.paste_flag !== true ) { return; }
			me.paste_flag = false;

			//console.log( '------------------------------------------------------------' );
			//console.log( 'handle_PASTE_COMPLETE', event );

			var tag, identifier, number, subsequent,
				current_items = [], new_paras = [], paras = [],
				previous_element = false, stop_now = false;

			// get current identifiers
			$('.fee-content-body').find( '[data-incom]' ).each( function( i, element ) {
				current_items.push( $(element).attr( 'data-incom' ) );
			});

			// get current paras
			paras = $('.fee-content-body p');

			// get unidentified paras and find the para prior to them
			paras.each( function( i, element ) {
				var id = $(element).attr( 'data-incom' );
				if ( 'undefined' === typeof id ) {
					new_paras.push( $(element) );
					stop_now = true;
				} else {
					if ( stop_now === false ) {
						previous_element = $(element);
					}
				}
			});

			// do we have one?
			if ( previous_element === false ) {
				return;
			}

			tag = previous_element.prop( 'tagName' ).substr( 0, 5 );
			identifier = previous_element.attr( 'data-incom' );
			number = parseInt( identifier.replace( tag, '' ) );

			// find any missing items
			missing = SocialPaperChange.tracker.get_missing( current_items );

			// if there are some missing
			if ( missing.length > 0 ) {

				// remove the missing items
				$.each( missing, function( index, value ) {

					var tracker_data;

					// remove from tracker
					tracker_data = SocialPaperChange.tracker.get_by( value, 'modified' );
					SocialPaperChange.tracker.remove( tracker_data );

					// reassign comments to current item
					SocialPaperChange.comments.reassign( value, identifier );

				});

			}

			// get subsequent
			subsequent = previous_element.nextAll( 'p' );

			// are there any?
			if ( subsequent.length > 0 ) {

				// reparse all p tags greater than this
				subsequent.each( function( i, el ) {

					var element, current_identifier, becomes, tracker_data;

					element = $( el );
					current_identifier = element.attr( 'data-incom' );

					// construct and apply new identifier
					number++;
					becomes = tag + number;
					element.attr( 'data-incom', becomes );

					// get data and update
					tracker_data = SocialPaperChange.tracker.get_by( current_identifier, 'modified' );
					tracker_data.modified = becomes;
					tracker_data.is_modified = true;

					// update tracker array
					SocialPaperChange.tracker.update( tracker_data );

				});

			}

			// update comment refs
			SocialPaperChange.comments.update();

		};

		/**
		 * Handle CUT key combination
		 *
		 * In practice, this seems to need identical handling to the DELETE key,
		 * so let's route this onwards until there's a need to do otherwise.
		 */
		this.handle_CUT = function( event ) {
			this.handle_DELETE();
		};

		/**
		 * Handle ENTER key
		 *
		 * NB: in OSX Chrome, hitting the ENTER key whilst there is an uncollapsed
		 * selection results only in the contents of the selection being deleted.
		 * This is different to how text editors tend to behave - they would also
		 * add the newline. This means that no new node is created, though one or
		 * more may be deleted.
		 *
		 * Unfortunately, there is no way to tell if there was a selection when the
		 * enter key was pressed, since me.instance.selection.isCollapsed()
		 * reports true on both keydown and keyup. We therefore have to rely on the
		 * state of SocialPaperChange.tracker.data to see what's missing.
		 */
		this.handle_ENTER = function() {

			//console.log( '------------------------------------------------------------' );
			//console.log( 'handle_ENTER' );

			var node, item, tag, identifier, number, subsequent,
				current_items = [], missing = [],
				original_num;

			// get keyup identifiers
			$('.fee-content-body').find( '[data-incom]' ).each( function( i, element ) {
				current_items.push( $(element).attr( 'data-incom' ) );
			});

			// get current node and tease out data
			node = me.instance.selection.getNode();
			item = $( node );
			tag = item.prop( 'tagName' ).substr( 0, 5 );
			identifier = item.attr( 'data-incom' );

			// bail if we don't have one
			if ( 'undefined' === typeof identifier ) {
				return;
			}

			// strip tag from identifier to get number
			number = parseInt( identifier.replace( tag, '' ) );

			// find any missing items
			missing = SocialPaperChange.tracker.get_missing( current_items );

			// if there are some missing
			if ( missing.length > 0 ) {

				/**
				 * This is effectively our test for an uncollapsed selection that
				 * spans a number of paragraphs. See the docblock above.
				 */

				// remove the missing items
				$.each( missing, function( index, value ) {

					var tracker_data;

					// remove from tracker
					tracker_data = SocialPaperChange.tracker.get_by( value, 'modified' );
					SocialPaperChange.tracker.remove( tracker_data );

					// reassign comments to current item
					SocialPaperChange.comments.reassign( value, identifier );

				});

			} else {

				/**
				 * There wasn't a selection that altered the paras
				 * i.e. ENTER created a new paragraph
				 */

				number++;

			}

			// get subsequent
			subsequent = item.nextAll( 'p' );

			// are there any?
			if ( subsequent.length > 0 ) {

				// reparse all p tags greater than this
				subsequent.each( function( i, el ) {

					var element, current_identifier, becomes, tracker_data;

					element = $( el );
					current_identifier = element.attr( 'data-incom' );

					// construct and apply new identifier
					number++;
					becomes = tag + number;
					element.attr( 'data-incom', becomes );

					// get data and update
					tracker_data = SocialPaperChange.tracker.get_by( current_identifier, 'modified' );
					tracker_data.modified = becomes;
					tracker_data.is_modified = true;

					// update tracker array
					SocialPaperChange.tracker.update( tracker_data );

				});

			}

			// if collapsed all along
			if ( missing.length === 0 ) {

				// recalculate
				original_num = parseInt( identifier.replace( tag, '' ) );

				// bump this item
				item.attr( 'data-incom', tag + ( original_num + 1 ) );

				// add to array
				SocialPaperChange.tracker.add( {
					is_new: true,
					is_modified: false,
					original: tag + original_num,
					modified: tag + ( original_num + 1 ),
				} );

			}

			// update comment refs
			SocialPaperChange.comments.update();

		};

		/**
		 * Handle DELETE and BACKSPACE keys
		 *
		 * Whether backspace, forward-delete, word-delete or any other is pressed,
		 * all existing paragraphs must be checked and matched against current ones.
		 *
		 * The 'node' var gives us the position of the caret after the delete has
		 * taken place, so that if paragraphs are merged, we can:
		 * (a) decrement the paras that still follow,
		 * (b) merge the comment associations for the merged paras,
		 * (c) assign comments on deleted paras to the current one.
		 *
		 * Unfortunately, there is no way to tell if there was a selection when the
		 * delete key was pressed, since me.instance.selection.isCollapsed()
		 * reports true on both keydown and keyup. We therefore have to rely on the
		 * state of SocialPaperChange.tracker.data to see what's missing.
		 */
		this.handle_DELETE = function() {

			//console.log( '------------------------------------------------------------' );
			//console.log( 'handle_DELETE' );

			var node, item, tag, identifier, number, subsequent,
				current_items = [], missing = [];

			// get current identifiers
			$('.fee-content-body').find( '[data-incom]' ).each( function( i, element ) {
				current_items.push( $(element).attr( 'data-incom' ) );
			});

			// get current node and tease out data
			node = me.instance.selection.getNode();
			item = $( node );
			tag = item.prop( 'tagName' ).substr( 0, 5 );
			identifier = item.attr( 'data-incom' );

			// bail if we don't have one
			if ( 'undefined' === typeof identifier ) {
				return;
			}

			// strip tag from identifier to get number
			number = parseInt( identifier.replace( tag, '' ) );

			// find any missing items
			missing = SocialPaperChange.tracker.get_missing( current_items );

			// bail if there's no difference
			if ( missing.length == 0 ) {
				return;
			}

			// remove the missing items
			$.each( missing, function( index, value ) {

				var tracker_data;

				// remove from tracker
				tracker_data = SocialPaperChange.tracker.get_by( value, 'modified' );
				SocialPaperChange.tracker.remove( tracker_data );

				// reassign comments to current item
				SocialPaperChange.comments.reassign( value, identifier );

			});

			// get subsequent nodes
			subsequent = item.nextAll( 'p' );

			// are there any?
			if ( subsequent.length > 0 ) {

				// reparse all p tags greater than this
				subsequent.each( function( i, el ) {

					var element, current_identifier, becomes, tracker_data;

					element = $( el );
					current_identifier = element.attr( 'data-incom' );

					// construct new identifier
					number++;
					becomes = tag + ( number );

					// if this is the same, there's no need to apply
					if ( current_identifier == becomes ) {
						return false;
					}

					// apply new identifier
					element.attr( 'data-incom', becomes );

					// get data and update
					tracker_data = SocialPaperChange.tracker.get_by( current_identifier, 'modified' );
					tracker_data.modified = becomes;
					tracker_data.is_modified = true;

					// update tracker array
					SocialPaperChange.tracker.update( tracker_data );

				});

			}

			// update comments
			SocialPaperChange.comments.update();

		};

		/**
		 * Handle any key that produces a printing character.
		 *
		 * We only need to track changes when the selection is *not* collapsed, since
		 * the selection could span two or more nodes.
		 */
		this.handle_PRINTING_CHAR = function( keystate ) {

			//console.log( '------------------------------------------------------------' );
			//console.log( 'handle_PRINTING_CHAR' );

			var node, item, tag, identifier, number, subsequent,
				current_items = [], missing = [];

			// get current identifiers on keydown
			if ( ! me.instance.selection.isCollapsed() && keystate == 'keydown' ) {
				me.keydown_items = [];
				item = $( me.instance.selection.getNode() );
				if ( item.hasClass( 'fee-content-body' ) ) {
					item.children( 'p' ).each(function ( i, el ) {
						me.keydown_items.push( $(el).attr( 'data-incom' ) );
					});
				}
				return;
			}

			// bail if there was never a selection
			if (
				me.instance.selection.isCollapsed() &&
				keystate == 'keyup' &&
				me.keydown_items.length === 0
			) {
				me.keydown_items = [];
				return;
			}

			// get keyup identifiers
			$('.fee-content-body').find( '[data-incom]' ).each( function( i, element ) {
				current_items.push( $(element).attr( 'data-incom' ) );
			});

			// get current node and tease out data
			node = me.instance.selection.getNode();
			item = $( node );
			tag = item.prop( 'tagName' ).substr( 0, 5 );
			identifier = item.attr( 'data-incom' );

			// bail if we don't have one
			if ( 'undefined' === typeof identifier ) {
				return;
			}

			// strip tag from identifier to get number
			number = parseInt( identifier.replace( tag, '' ) );

			// get subsequent
			subsequent = item.nextAll( 'p' );

			// are there any?
			if ( subsequent.length > 0 ) {

				// find missing items
				missing = $( me.keydown_items ).not( current_items ).get();

				// assign comments on missing items to current identifier
				$.each( missing, function( index, value ) {

					var tracker_data;

					// remove from tracker
					tracker_data = SocialPaperChange.tracker.get_by( value, 'modified' );
					SocialPaperChange.tracker.remove( tracker_data );

					// reassign comments to new item
					SocialPaperChange.comments.reassign( value, identifier );

				});

				// reparse all p tags greater than this
				subsequent.each( function( i, el ) {

					var element, current_identifier, becomes, tracker_data;

					element = $( el );
					current_identifier = element.attr( 'data-incom' );

					// construct and apply new identifier
					number++;
					becomes = tag + ( number );
					element.attr( 'data-incom', becomes );

					// get data and update
					tracker_data = SocialPaperChange.tracker.get_by( current_identifier, 'modified' );
					tracker_data.modified = becomes;
					tracker_data.is_modified = true;

					// update tracker array
					SocialPaperChange.tracker.update( tracker_data );

				});

			} else {

				// assign comments to current identifier if greater than current
				$.each( me.keydown_items, function( index, value ) {

					var n, tracker_data;

					n = parseInt( value.replace( tag, '' ) );
					if ( n > number ) {

						// remove from tracker
						tracker_data = SocialPaperChange.tracker.get_by( value, 'modified' );
						SocialPaperChange.tracker.remove( tracker_data );

						// reassign comments
						SocialPaperChange.comments.reassign( value, identifier );

					}

				});

			}

			// update comments
			SocialPaperChange.comments.update();

		};

		/**
		 * Add Inline Comments 'data-incom' attributes to TinyMCE content.
		 *
		 * This is done by copying the original content to TinyMCE and overwriting
		 * the content of the editor. Simple, but effective!
		 */
		this.copy_original = function() {
			me.instance.setContent( $('.fee-content-original').html(), {format : 'html'} );
		};

	};

	/**
	 * Create Comments object.
	 */
	SocialPaperChange.comments = new function() {

		var me = this;

		// tracks the comments that need their refs updated
		me.data = [];

		/**
		 * Assign Inline Comments 'data-incom-comment' attributes from one target to another
		 *
		 * @param str existing The existing identifier
		 * @param str target The target identifier
		 */
		this.reassign = function( existing, target ) {

			// reassign comments to new item
			$( 'li[data-incom-comment="' + existing + '"]' ).each( function( i, el ) {

				//console.log( 'reassigning comments: ', existing, target );

				// update custom attribute
				$(el).attr( 'data-incom-comment', target );

				// update (or add) to data-to-send-on-save
				var comment_id = $(el).prop( 'id' );
				me.data[comment_id] = target;

			});

		};

		/**
		 * Update Inline Comments 'data-incom-comment' attributes for comments
		 */
		this.update = function() {

			// with each of the tracked items
			SocialPaperChange.tracker.data.forEach( function( item ) {

				// if this item is modified and pre-existing
				if ( item.is_modified && ! item.is_new ) {

					// update the comments that reference it
					$( 'li[data-incom-comment="' + item.original + '"]' ).each( function( i, el ) {
						if ( ! $(el).hasClass( 'sp_processed' ) ) {

							//console.log( 'updating comments: ', item.original, item.modified );

							$(el).attr( 'data-incom-comment', item.modified );
							$(el).addClass( 'sp_processed' );

							// update (or add) to data-to-send-on-save
							var comment_id = $(el).prop( 'id' );
							me.data[comment_id] = item.modified;

						}
					});

				}

			});

			// remove processed identifier
			$('li.sp_processed').removeClass( 'sp_processed' );

			// rebuild tracker
			SocialPaperChange.tracker.rebuild();

		};

		/**
		 * Export data for changed comments.
		 *
		 * @return array formatted The array of amended comment data
		 */
		this.get_formatted = function() {

			// construct formatted array
			var formatted = [];
			for( key in me.data ) {
				formatted.push({
					comment_id: key,
					new_value: me.data[key],
				});
			}

			return formatted;

		};

	};

});

/**
 * Handle WP FEE hooks when the page is ready
 */
jQuery(document).ready( function($) {

	/**
	 * Hook into WP FEE initialisation.
	 */
	$(document).on( 'fee-editor-init', function( event ) {

		// start tracking the editor
		SocialPaperChange.editor.track( event );

	});

	/**
	 * Hook into WP FEE activation.
	 */
	$(document).on( 'fee-on', function( event ) {

		//console.log( 'fee-on' );

		// if Inline Comments present
		if ( window.incom ) {

			// build tracker array
			SocialPaperChange.tracker.init();

			// set up attributes in TinyMCE content
			SocialPaperChange.editor.copy_original();

		}

	});

	/**
	 * Hook into WP FEE deactivation.
	 */
	$(document).on( 'fee-off', function( event ) {

		//console.log( 'fee-off' );

	});

	/**
	 * Hook into WP FEE before save.
	 */
	$(document).on( 'fee-before-save', function( event ) {

		//console.log( 'fee-before-save' );

		// if Inline Comments present
		if ( window.incom ) {

			// send an array of changed comment data along with the post data
			wp.fee.post.social_paper_comments = function() {
				var to_send = SocialPaperChange.comments.get_formatted();
				SocialPaperChange.comments.data = [];
				return to_send;
			};

		}

	});

	/**
	 * Hook into WP FEE after save.
	 */
	$(document).on( 'fee-after-save', function( event ) {

		//console.log( 'fee-after-save' );

		if ( window.incom ) {

			// rebuild TinyMCE content (since this what's visible)
			window.incom.rebuild();

			// build tracker array
			//SocialPaperChange.tracker.init();

			// set attributes in TinyMCE content
			//SocialPaperChange.tracker.rebuild();

		}

	});

});