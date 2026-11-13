@publishing
Feature: Previewing, publishing, scheduling and unpublishing
  A draft is previewed, published through the publish dialog, updated,
  taken back to a draft or scheduled for later.

  Background:
    Given I am logged in to the admin as "editor"
    And there is no post titled "A post from the suite"
    And there is no post titled "A post from the suite, updated"

  Scenario: The preview shows the draft as the site would
    When I start a new post
    And I set the editor title to "A post from the suite"
    And I write "A text to preview." in the editor
    And I wait for the editor to save
    And I preview the post
    Then the preview should show "A post from the suite"
    And the preview should show "A text to preview."
    And the preview should not show "Lorem ipsum"
    When I close the preview
    And I delete the post from the editor
    Then I should not see the post "A post from the suite" in the list

  @critical
  Scenario: A post is published, updated and unpublished
    When I start a new post
    And I set the editor title to "A post from the suite"
    And I write "Published by the suite." in the editor
    And I open the publish dialog
    Then the publish dialog should say "Ready, set, publish."
    And the publish dialog should say "Right now"
    And the publish dialog should say "Your post will be published on your site."
    When I publish the post
    Then the publish confirmation should say "It’s out there"
    And the publish confirmation should say "A post from the suite"
    When I close the publish confirmation
    Then I should see the post "A post from the suite" in the list
    And the post "A post from the suite" should have the status "Published" in the list
    When I go to "/a-post-from-the-suite/"
    Then I should see "Published by the suite."
    When I open the editor of the post "A post from the suite"
    Then the editor status should be "Published"
    When I set the editor title to "A post from the suite, updated"
    And I update the post
    Then I should see the notification "Post updated"
    When I go to "/a-post-from-the-suite/"
    Then I should see "A post from the suite, updated"
    When I open the editor of the post "A post from the suite, updated"
    And I unpublish the post
    Then the editor status should be "Draft"
    And I should see the notification "Post reverted to a draft."
    And the editor should offer "Publish"
    When I go to "/a-post-from-the-suite/"
    Then the response status code should be 404
    Given there is no post titled "A post from the suite, updated"

  Scenario: The publish dialog can be closed without publishing
    When I start a new post
    And I set the editor title to "A post from the suite"
    And I open the publish dialog
    And I close the publish dialog
    Then the editor status should be "Draft"
    When I delete the post from the editor
    Then I should not see the post "A post from the suite" in the list

  Scenario: A post is scheduled for later and taken back
    When I start a new post
    And I set the editor title to "A post from the suite"
    And I write "For later." in the editor
    And I schedule the post for "2031-05-01" at "09:30"
    And I close the publish confirmation
    Then the post "A post from the suite" should have the status "Scheduled" in the list
    When I go to the admin screen "Scheduled"
    Then I should see the post "A post from the suite" in the list
    When I open the editor of the post "A post from the suite"
    Then the editor status should be "Scheduled"
    When I unpublish the post
    Then the editor status should be "Draft"
    When I delete the post from the editor
    Then I should not see the post "A post from the suite" in the list

  Scenario: A page is published and deleted
    Given there is no page titled "A page from the suite"
    When I start a new page
    And I set the editor title to "A page from the suite"
    And I write "A page text." in the editor
    And I publish the page
    Then the publish confirmation should say "A page from the suite"
    When I close the publish confirmation
    Then I should see the page "A page from the suite" in the list
    When I go to "/a-page-from-the-suite/"
    Then I should see "A page text."
    When I open the editor of the page "A page from the suite"
    And I delete the page from the editor
    Then I should be on the admin screen "Pages"
    And I should not see the page "A page from the suite" in the list
