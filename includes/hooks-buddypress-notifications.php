<?php

/**
 * Integration with the BuddyPress Notifications component.
 *
 * @since 1.0.0
 */

/**
 * Format notifications.
 *
 * @since 1.0.0
 *
 */
function cacsp_format_notifications( $action, $paper_id, $secondary_item_id, $count, $format = 'string' ) {
	$paper = new CACSP_Paper( $paper_id );

	switch ( $action ) {
		case 'added_reader' :
			if ( (int) $count > 1 ) {
				$text = sprintf( _n( 'You have been added as a reader on %s paper', 'You have been added as a reader to %s papers', $count, 'social-paper' ), $count );

				// @todo Some directory.
				$link = '';
			} else {
				$text = sprintf( __( '%s has added you as a reader on the paper "%s"', 'social-paper' ), bp_core_get_user_displayname( $secondary_item_id ), $paper->post_title );
				$link = get_permalink( $paper_id );
			}

			break;

		case 'mypaper_comment' :
			if ( (int) $count > 1 ) {
				$text = sprintf( _n( 'You have %s comment on your papers', 'You have %s comments on your papers', $count, 'social-paper' ), $count );

				// @todo Notifications directory? Maybe only if corresponding to more than one paper?
				$link = get_comment_link( $secondary_item_id );
			} else {
				$paper = new CACSP_Paper( $paper_id );
				$text = sprintf( __( 'You have a new comment on your paper "%s"', 'social-paper' ), $paper->post_title );
				$link = get_comment_link( $secondary_item_id );
			}

			break;

		case 'mythread_comment' :
			if ( (int) $count > 1 ) {
				$text = __( 'There is new activity on papers where you have commented', 'social-paper' );

				// @todo Notifications directory? Maybe only if corresponding to more than one paper?
				$link = get_comment_link( $secondary_item_id );
			} else {
				$paper = new CACSP_Paper( $paper_id );
				$text = sprintf( __( 'There is new activity on the paper "%s"', 'social-paper' ), $paper->post_title );
				$link = get_comment_link( $secondary_item_id );
			}

			break;

		case 'comment_mention' :
			if ( (int) $count > 1 ) {
				$text = __( 'You have been mentioned in papers', 'social-paper' );

				// @todo Notifications directory? Maybe only if corresponding to more than one paper?
				$link = get_comment_link( $secondary_item_id );
			} else {
				$paper = new CACSP_Paper( $paper_id );
				$text = sprintf( __( 'You&#8217;ve been mentioned in a comment on the paper "%s"', 'social-paper' ), $paper->post_title );
				$link = get_comment_link( $secondary_item_id );
			}

			break;
	}

	if ( 'array' === $format ) {
		return array(
			'link' => $link,
			'text' => $text,
		);
	} else {
		return sprintf( '<a href="%s">%s</a>', $link, $text );
	}
}

/**
 * Send an email related to a notification.
 *
 * @since 1.0.0
 *
 * @todo This would be a good place to block multiple emails. Maybe create a hash of user IDs + notification IDs,
 * and don't let multiple emails for a given notification ID to go out to a single user. Doesn't need to be persistent.
 *
 * @param array $args {
 *     @type int    $recipient_user_id ID of the user receiving the message.
 *     @type int    $sender_user_id    ID of the user responsible for triggering the message.
 *     @type int    $paper_id          ID of the paper.
 *     @type string $subject           Email subject base. Will be prepended with site name.
 *     @type string $content           Email content. Will be embedded within content template.
 *     @type string $type              Type of notification. Used for fine-grained email settings.
 * }
 * @return bool|WP_Error Returns true on success, WP_Error on failure.
 */
function cacsp_send_notification_email( $args = array() ) {
	$r = wp_parse_args( $args, array(
		'recipient_user_id' => null,
		'sender_user_id'    => bp_loggedin_user_id(),
		'paper_id'          => null,
		'subject'           => '',
		'content'           => '',
		'type'              => '',
	) );

	$recipient = new WP_User( $r['recipient_user_id'] );
	if ( ! $recipient->exists() ) {
		return new WP_Error( 'user_not_found', __( 'User does not exist.', 'social-paper' ), $r['recipient_user_id'] );
	}

	// @todo Allow filtering based on 'type', 'paper_id', or other user settings.

	$subject = bp_get_email_subject( array( 'text' => $r['subject'] ) );

	return wp_mail( $recipient->user_email, $subject, $r['content'] );
}

/** Specific notifications ***************************************************/

/**
 * Notify a user when added as a reader to a paper.
 *
 * @since 1.0.0
 *
 * @param CACSP_Paper $paper   Paper object.
 * @param int         $user_id ID of the user added as a reader.
 */
function cacsp_notification_added_reader( CACSP_Paper $paper, $user_id ) {
	$type = 'added_reader';

	$added = bp_notifications_add_notification( array(
		'user_id' => $user_id,
		'item_id' => $paper->ID,
		'secondary_item_id' => bp_loggedin_user_id(),
		'component_name' => 'cacsp',
		'component_action' => $type,
	) );

	$text = sprintf( __( '%s has added you as a reader on the paper "%s".', 'social-paper' ), bp_core_get_user_displayname( bp_loggedin_user_id() ), $paper->post_title );
	$link = wp_login_url( get_permalink( $paper->ID ) );
	$content = sprintf( __(
'%1$s

Visit the paper: %2$s', 'social-paper' ), $text, $link );

	cacsp_send_notification_email( array(
		'recipient_user_id' => $user_id,
		'paper_id' => $paper->ID,
		'subject' => $text,
		'content' => $content,
		'type' => $type,
	) );
}
add_action( 'cacsp_added_reader_to_paper', 'cacsp_notification_added_reader', 10, 2 );

/**
 * Prevent WP from sending its native postauthor email notifications for comments.
 *
 * We send our own. This is an ugly hack.
 *
 * @since 1.0.0
 *
 * @param array $emails     Array of email addresses to notify. We'll wipe it out to noop wp_notify_postauthor().
 * @param int   $comment_id ID of the comment.
 */
function cacsp_prevent_wp_notify_postauthor( $emails, $comment_id ) {
	$comment = get_comment( $comment_id );
	if ( ! $comment ) {
		return $emails;
	}

	$paper = new CACSP_Paper( $comment->comment_post_ID );
	$paper_id = $paper->ID;
	if ( ! $paper_id ) {
		return $emails;
	}

	return array();
}
add_filter( 'comment_notification_recipients', 'cacsp_prevent_wp_notify_postauthor', 10, 2 );

/**
 * Notify a user when a comment is left on her paper.
 *
 * @since 1.0.0
 *
 * @param int $comment_id ID of the comment.
 */
function cacsp_notification_mypaper_comment( $comment_id ) {
	$comment = get_comment( $comment_id );
	if ( ! $comment ) {
		return;
	}

	$paper = new CACSP_Paper( $comment->comment_post_ID );
	$paper_id = $paper->ID;
	if ( ! $paper_id ) {
		return;
	}

	$type = 'mypaper_comment';

	// Don't notify authors of their own comments.
	if ( $comment->user_id == $paper->post_author ) {
		return;
	}

	$added = bp_notifications_add_notification( array(
		'user_id' => $paper->post_author,
		'item_id' => $paper->ID,
		'secondary_item_id' => $comment_id,
		'component_name' => 'cacsp',
		'component_action' => $type,
	) );

	$subject = sprintf( __( 'New comment on your paper "%s"', 'social-paper' ), $paper->post_title );

	$content  = sprintf( __( 'New comment on your paper "%s"', 'social-paper' ), $paper->post_title ) . "\r\n";
	$content .= sprintf( __( 'Author: %s', 'social-paper' ), $comment->comment_author ) . "\r\n";
	$content .= sprintf( __( 'Comment: %s', 'social-paper' ), "\r\n" . $comment->comment_content ) . "\r\n\r\n";
	$content .= sprintf( __( 'View the commment: %s', 'social-paper' ), get_comment_link( $comment ) ) . "\r\n";
	$content .= sprintf( __( 'Visit the paper: %s', 'social-paper' ), get_permalink( $paper->ID ) ) . "\r\n";

	cacsp_send_notification_email( array(
		'recipient_user_id' => $paper->post_author,
		'paper_id' => $paper->ID,
		'subject' => $subject,
		'content' => $content,
		'type' => $type,
	) );
}
add_action( 'wp_insert_comment', 'cacsp_notification_mypaper_comment' );

/**
 * Notify a user when a comment is left on a thread where the user has commented.
 *
 * Excludes post authors, who are notified with 'mypost_comment'.
 *
 * Currently, the notifications fire for all users who have commented on the *post*.
 *
 * @todo A more fine-grained concept of "thread": comments belonging to a single paragraph; comments with common
 *       ancestors; a comment that is a direct descendant of the other.
 * @todo Maybe this should be replaced with (or at least integrated tightly with) Follow. Ie, when you comment
 *       on a paper, you automatically follow it. This wouldn't be thread-specific.
 *
 * @since 1.0.0
 *
 * @param int $comment_id ID of the comment.
 */
function cacsp_notification_mythread_comment( $comment_id ) {
	$comment = get_comment( $comment_id );
	if ( ! $comment ) {
		return;
	}

	$paper = new CACSP_Paper( $comment->comment_post_ID );
	$paper_id = $paper->ID;
	if ( ! $paper_id ) {
		return;
	}

	// Fetch emails of previous commenters.
	$comments = get_comments( array(
		'comment_post_ID' => $paper_id,
		'update_comment_meta_cache' => false,
		'update_comment_post_cache' => false,
	) );

	// @todo Can't use user_id because it's not always provided?
	$emails = wp_list_pluck( $comments, 'comment_author_email' );
	$emails = array_unique( array_filter( $emails ) );

	if ( empty( $emails ) ) {
		return;
	}

	$type = 'mythread_comment';

	$email_subject = sprintf( __( 'New comment on the paper "%s"', 'social-paper' ), $paper->post_title );
	$email_content  = sprintf( __( 'New comment on the paper "%s"', 'social-paper' ), $paper->post_title ) . "\r\n";
	$email_content .= sprintf( __( 'Author: %s', 'social-paper' ), $comment->comment_author ) . "\r\n";
	$email_content .= sprintf( __( 'Comment: %s', 'social-paper' ), "\r\n" . $comment->comment_content ) . "\r\n\r\n";
	$email_content .= sprintf( __( 'View the commment: %s', 'social-paper' ), get_comment_link( $comment ) ) . "\r\n";
	$email_content .= sprintf( __( 'Visit the paper: %s', 'social-paper' ), get_permalink( $paper->ID ) ) . "\r\n\r\n";

	foreach ( $emails as $email ) {
		$user = get_user_by( 'email', $email );
		if ( ! $user ) {
			continue;
		}

		// We handle the post author elsewhere.
		if ( $user->ID == $paper->post_author ) {
			continue;
		}

		$added = bp_notifications_add_notification( array(
			'user_id' => $user->ID,
			'item_id' => $paper->ID,
			'secondary_item_id' => $comment_id,
			'component_name' => 'cacsp',
			'component_action' => $type,
		) );

		cacsp_send_notification_email( array(
			'recipient_user_id' => $user->ID,
			'paper_id' => $paper->ID,
			'subject' => $email_subject,
			'content' => $email_content,
			'type' => $type,
		) );
	}
}
add_action( 'wp_insert_comment', 'cacsp_notification_mythread_comment' );

/**
 * Notify a user when a comment is left with an @-mention of a user.
 *
 * Fired from cacsp_at_mention_send_notifications().
 *
 * @todo This will produce duplicate comment notifications in some cases. Figure out the precedence, and how to
 *       keep track and deduplicate.
 * @todo Maybe this should be replaced with (or at least integrated tightly with) Follow. Ie, when you comment
 *       on a paper, you automatically follow it. This wouldn't be thread-specific.
 *
 * @since 1.0.0
 *
 * @param int   $activity_id ID of the cacsp_new_comment activity item triggering the notification.
 * @param array $user_ids    IDs of the users the notification is being sent to.
 */
function cacsp_notification_comment_mention( $activity_id, $user_ids ) {
	if ( empty( $user_ids ) ) {
		return;
	}

	$activity = new BP_Activity_Activity( $activity_id );
	if ( empty( $activity->secondary_item_id ) ) {
		return;
	}

	$comment_id = $activity->item_id;
	$_paper_id  = $activity->secondary_item_id;

	$comment = get_comment( $comment_id );
	if ( ! $comment ) {
		return;
	}

	$paper = new CACSP_Paper( $comment->comment_post_ID );
	$paper_id = $paper->ID;
	if ( ! $paper_id || $paper_id != $_paper_id ) {
		return;
	}

	// Pull up info on the commenter.
	if ( ! empty( $comment->user_id ) ) {
		$comment_user_id = (int) $comment->user_id;
		$comment_user = new WP_User( $comment_user_id );
	} else {
		$_comment_user = get_user_by( 'email', $comment->comment_author_email );
		if ( $_comment_user->exists() ) {
			$comment_user = $_comment_user;
			$comment_user_id = (int) $comment_user->ID;
		}
	}

	$type = 'comment_mention';

	// Fetch emails of users.
	$users = get_users( array(
		'include' => $user_ids,
		'fields' => 'all',
	) );

	$emails = array();
	foreach ( $users as $u ) {
		$emails[ $u->ID ] = $u->user_email;
	}

	if ( empty( $emails ) ) {
		return;
	}

	$email_subject = sprintf( __( 'You&#8217;ve been mentioned in a comment on the paper "%s"', 'social-paper' ), $paper->post_title );
	$email_content  = sprintf( __( '%1$s mentioned you in a comment on the paper "%2$s"', 'social-paper' ), bp_core_get_user_displayname( $comment_user_id ), $paper->post_title ) . "\r\n\r\n";
	$email_content .= sprintf( _x( '"%s"', 'Mention email notification comment content', 'social-paper' ), $comment->comment_content ) . "\r\n\r\n";
	$email_content .= sprintf( __( 'View the commment: %s', 'social-paper' ), get_comment_link( $comment ) ) . "\r\n";
	$email_content .= sprintf( __( 'Visit the paper: %s', 'social-paper' ), get_permalink( $paper->ID ) ) . "\r\n\r\n";

	foreach ( $emails as $user_id => $email ) {
		// We handle the post author elsewhere.
		if ( $user_id == $paper->post_author ) {
			continue;
		}

		$added = bp_notifications_add_notification( array(
			'user_id' => $user_id,
			'item_id' => $paper->ID,
			'secondary_item_id' => $comment_id,
			'component_name' => 'cacsp',
			'component_action' => $type,
		) );

		cacsp_send_notification_email( array(
			'recipient_user_id' => $user_id,
			'paper_id' => $paper->ID,
			'subject' => $email_subject,
			'content' => $email_content,
			'type' => $type,
		) );
	}
}
add_action( 'wp_insert_comment', 'cacsp_notification_mythread_comment' );

/** Marking read *************************************************************/

/**
 * Mark all notifications read for a user + paper combination.
 *
 * Optionally, you can also pass a 'type' which will limit the marking-read to notifications matching
 * that 'component_action'.
 *
 * @since 1.0.0
 *
 * @param int    $user_id           ID of the user.
 * @param int    $paper_id          ID of the paper.
 * @param string $type              Optional. 'component_action' to limit to.
 * @param int    $secondary_item_id Optional. 'secondary_item_id' to limit to.
 */
function cacsp_mark_notifications_read( $user_id, $paper_id, $type = '', $secondary_item_id = '' ) {
	$where = array(
		'user_id'        => $user_id,
		'item_id'        => $paper_id,
		'component_name' => 'cacsp',
	);

	if ( $type ) {
		$where['component_action'] = $type;
	}

	if ( $secondary_item_id ) {
		$where['secondary_item_id'] = $secondary_item_id;
	}

	return BP_Notifications_Notification::update(
		array( 'is_new' => 0 ),
		$where
	);
}

/**
 * Mark notifications read when a user views a paper.
 *
 * @since 1.0.0
 */
function cacsp_mark_notifications_read_on_paper_view() {
	if ( ! is_user_logged_in() ) {
		return;
	}

	$queried_object = get_queried_object();
	if ( ! ( $queried_object instanceof WP_Post ) || 'cacsp_paper' !== $queried_object->post_type ) {
		return;
	}

	cacsp_mark_notifications_read( bp_loggedin_user_id(), $queried_object->ID );
}
add_action( 'bp_actions', 'cacsp_mark_notifications_read_on_paper_view' );