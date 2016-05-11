( function( $ ){
	var $description,
		$description_char_ratio,
		$description_char_count,
		$allVideos,
		$fluidEl;

	$( document ).ready( function(){
		var $reader_selector = $( '#cacsp-reader-selector' );

		$( 'body' ).removeClass( 'no-js' ).addClass( 'js' );

		responsive_iframes();

		if ( $reader_selector.length && $.isFunction( $.fn.select2 ) ) {
			$reader_selector.select2( {
				ajax: {
					url: SocialPaperI18n.rest_url + 'readers/',
					dataType: 'json',
					delay: 500,
					data: function( params ) {
						return {
							search: params.term
						};
					},
					processResults: function( results ) {
						var formatted_results = {};
						formatted_results.results = results;
						return formatted_results;
					}
				},
				placeholder: SocialPaperI18n.reader_placeholder
			} );

			$reader_selector.trigger( 'change' );

			force_select2_width();

			var cacsp_group_selector = $( '#cacsp-group-selector' ).select2( {
				placeholder: SocialPaperI18n.group_placeholder
			} );
			if ( SocialPaperI18n !== '' ) {
				cacsp_group_selector.select2( 'val', SocialPaperI18n.group_id );
			}
		}

		if ( 'undefined' !== typeof bp && 'undefined' !== typeof bp.mentions.users ) {
			var $incom_text = $( '#incom-commentform textarea' );
			$incom_text.bp_mentions( bp.mentions.users );

			// Don't let Inline Comments collapse comments on @-mentions selection.
			$( '#atwho-container' ).click( function( e ) {
				e.stopPropagation();
			});
		}

		// Initialize the tags interface.
		window.SocialPaperTagBox && window.SocialPaperTagBox.init();

		// Character count for the Description field.
		$description = $( '#cacsp-paper-description' );
		$description_char_ratio = $( '.cacsp-description-char-ratio' );
		$description_char_count = $description_char_ratio.find( 'span' );
		$description.on( 'input', function() {
			update_description_char_count();
		} );

		// Run right away, to color the counts.
		update_description_char_count();

		// Autogrow the description field.
		$description.autogrow( {
			onInitialize: true,
			fixMinHeight: false,
			animate: false
		} );

		// Trigger autogrow to do its initial logic :(
		$description.trigger( 'keyup' );
	} );

	update_description_char_count = function() {
                var count = 0;
                if ( $description.val() ) {
                        count = $description.val().length;
                }

		var class_to_add;

		$description_char_count.html( count );

		if ( count > SocialPaperI18n.description_max_length ) {
			class_to_add = 'red';
		} else if ( count > ( SocialPaperI18n.description_max_length * .75 ) ) {
			class_to_add = 'orange';
		}

		$description_char_ratio.removeClass( 'red orange' );
		$description_char_ratio.addClass( class_to_add );
	}

	// @link https://css-tricks.com/NetMag/FluidWidthVideo/Article-FluidWidthVideo.php
	responsive_iframes = function() {
		$allVideos = $(".entry-content iframe"),
		$fluidEl = $(".entry-content");

		$allVideos.each(function() {
			$(this)
			// jQuery .data does not work on object/embed elements
			.attr('data-aspectRatio', $(this).height() / $(this).width() )
			.removeAttr('height')
			.removeAttr('width');

		});

		$(window).resize(function() {

			var newWidth = $fluidEl.width();
			$allVideos.each(function() {

				var $el = $(this);
				$el
				.width(newWidth)
				.height(newWidth * $el.attr('data-aspectRatio'));

			});

		}).resize();
	}

	/**
	 * Force Select2 to the proper width.
	 *
	 * This is a garbage hack forced on us by the fact that Select2 only sizes properly for non-selected width
	 * when it's present in the DOM and visible.
	 */
	force_select2_width = function() {
		$( 'input.select2-search__field' ).css( 'width', '249px' );
	}

}( jQuery ) );
