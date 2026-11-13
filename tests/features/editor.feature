@editor
Feature: Writing a post in the editor
  The editor takes a title, a text and cards, saves by itself and keeps the
  settings of the post in a panel.

  Background:
    Given I am logged in to the admin as "editor"
    And there is no post titled "A post from the suite"

  @critical
  Scenario: A new post is saved as a draft with its title and text
    When I start a new post
    And I set the editor title to "A post from the suite"
    And I write "The first paragraph." in the editor
    And I wait for the editor to save
    Then the editor status should be "Draft - Saved"
    And the editor title should be "A post from the suite"
    And the editor should contain "The first paragraph."
    And the editor should not contain "Lorem ipsum"
    And the editor should offer "Preview"
    And the editor should offer "Publish"
    When I delete the post from the editor
    Then I should be on the admin screen "Posts"
    And I should not see the post "A post from the suite" in the list

  Scenario: Cards are added from the card menu
    When I start a new post
    And I set the editor title to "A post from the suite"
    And I write "Before the cards." in the editor
    And I add a "Divider" card to the editor
    And I add a "Callout" card with the text "Mind the gap." to the editor
    And I add an image card to the editor from the file "tests/fixtures/feature.png"
    And I write "After the cards." in the editor
    And I wait for the editor to save
    Then the editor should have 1 "Divider" card
    And the editor should have 1 "Callout" card
    And the editor should have 1 "Image" card
    And the editor should have 0 "Toggle" cards
    And the editor should contain "Mind the gap."
    And the editor should contain "After the cards."
    When I delete the post from the editor
    Then I should not see the post "A post from the suite" in the list

  Scenario: The settings panel keeps the address, tags, access, excerpt and the featured switch
    When I start a new post
    And I set the editor title to "A post from the suite"
    And I write "A text." in the editor
    And I wait for the editor to save
    And I open the post settings
    Then the post URL should be "a-post-from-the-suite"
    And the post access should be "Public"
    And the post should not be featured
    When I set the post URL to "suite-post"
    And I add the tag "News" to the post
    And I add the tag "Guides" to the post
    And I remove the tag "Guides" from the post
    And I set the post access to "Members only"
    And I set the excerpt to "A short summary."
    And I feature the post
    And I wait for the editor to save
    And I leave the editor
    And I open the editor of the post "A post from the suite"
    Then the post URL should be "suite-post"
    And the post should have the tag "News"
    And the post should not have the tag "Guides"
    And the post access should be "Members only"
    And the excerpt should be "A short summary."
    And the post should be featured
    When I stop featuring the post
    Then the post should not be featured
    When I delete the post from the editor
    Then I should not see the post "A post from the suite" in the list

  Scenario: A feature image is uploaded and removed
    When I start a new post
    And I set the editor title to "A post from the suite"
    Then the post should not have a feature image
    When I set the feature image to the file "tests/fixtures/feature.png"
    And I wait for the editor to save
    Then the post should have a feature image
    When I remove the feature image
    Then the post should not have a feature image
    When I wait for the editor to save
    And I delete the post from the editor
    Then I should not see the post "A post from the suite" in the list

  Scenario: An existing post opens with its content and settings
    When I open the editor of the post "Welcome to the test site"
    Then the editor title should be "Welcome to the test site"
    And the editor should contain "This is the welcome post."
    And the editor status should be "Published"
    And the editor should offer "Update"
    And the editor should offer "Unpublish"
    And the editor should not offer "Publish"
    And the post should have a feature image
    And the post URL should be "welcome-to-the-test-site"
    And the post should have the tag "News"
    And the excerpt should be "The first post of the test site."
    And the post should be featured
    When I close the post settings
    And I leave the editor
    Then I should be on the admin screen "Posts"
